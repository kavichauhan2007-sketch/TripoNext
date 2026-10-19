const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();
const { generateDynamicPlan } = require('./itineraryEngine');
const mfaService = require('./mfaService');
const db = require('./firebase');

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = process.env.SECRET_KEY || 'super_secret_travel_buddy_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// In-memory cache for API catalog responses
const _travelCatalogCache = new Map();

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Authentication required. No session token provided.' });
    
    if (token.startsWith('guest-token') || token.startsWith('local-token')) {
        req.user = { id: "1", email: 'rahul.traveler@triponext.com', name: 'Rahul Sharma' };
        return next();
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
        }
        // Disallow challenge tokens on protected user endpoints
        if (user.purpose === 'mfa_challenge') {
            return res.status(401).json({ error: 'MFA challenge incomplete. You must complete two-factor authentication first.' });
        }
        req.user = user;
        next();
    });
};

// ========================================================
// AUTHENTICATION APIS (FIREBASE CLOUD FIRESTORE)
// ========================================================

// API: Register User
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    try {
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await db.findOne('users', [{ field: 'email', op: '==', value: normalizedEmail }]);
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await db.insert('users', {
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            referral_code: "TRIP-" + Math.floor(1000 + Math.random() * 9000),
            referral_credits: 500,
            avatar: "avatar-1",
            home_city: "Delhi, India",
            travel_style: "Balanced",
            phone: "+91 98765 43210"
        });

        const token = jwt.sign({ id: newUser.id, email: newUser.email, name: newUser.name }, SECRET_KEY);
        res.json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email } });
    } catch (e) {
        console.error('Registration error:', e);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// API: Login User (with Secure Multi-Factor Authentication Challenge)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await db.findOne('users', [{ field: 'email', op: '==', value: normalizedEmail }]);
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });

        // If MFA is enabled on user account, issue restricted short-lived challenge token
        if (user.mfa_enabled && (Number(user.mfa_enabled) === 1 || user.mfa_enabled === '1' || user.mfa_enabled === true)) {
            const rateKey = `login_mfa_${user.id}`;
            const rateCheck = mfaService.checkRateLimit(rateKey);
            if (!rateCheck.allowed) {
                return res.status(429).json({ error: rateCheck.message });
            }

            const challengeId = crypto.randomUUID();
            const mfaToken = jwt.sign(
                { purpose: 'mfa_challenge', challengeId, userId: String(user.id) },
                SECRET_KEY,
                { expiresIn: '5m' }
            );
            const tokenHash = crypto.createHash('sha256').update(mfaToken).digest('hex');
            const expiresAt = Date.now() + (5 * 60 * 1000);

            await db.insert('mfa_challenges', {
                challenge_id: challengeId,
                user_id: String(user.id),
                token_hash: tokenHash,
                attempts_left: 5,
                expires_at: expiresAt,
                consumed: 0
            });

            mfaService.logAuditEvent(db, {
                userId: user.id,
                event: 'MFA_LOGIN_CHALLENGED',
                status: 'SUCCESS',
                req,
                details: { challengeId }
            });

            return res.json({
                mfa_required: true,
                mfa_token: mfaToken,
                challenge_id: challengeId,
                methods: ['totp', 'email_otp', 'recovery_code'],
                user_email_masked: mfaService.maskEmail(user.email)
            });
        }

        // Standard direct session token for non-MFA accounts
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET_KEY);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// ========================================================
// MULTI-FACTOR AUTHENTICATION (MFA) APIS (FIRESTORE)
// ========================================================

// 1. GET /api/auth/mfa/status - Fetch user MFA enrollment status
app.get(['/api/auth/mfa/status', '/auth/mfa/status'], authenticateToken, async (req, res) => {
    try {
        const user = await db.get('users', req.user.id);
        if (!user) return res.status(500).json({ error: 'User record not found' });

        const unusedCodes = await db.find('mfa_recovery_codes', [
            { field: 'user_id', op: '==', value: String(req.user.id) },
            { field: 'used', op: '==', value: 0 }
        ]);

        res.json({
            mfa_enabled: Boolean(user.mfa_enabled && (Number(user.mfa_enabled) === 1 || user.mfa_enabled === '1' || user.mfa_enabled === true)),
            enrolled_at: user.mfa_enrolled_at || null,
            method: user.mfa_enabled ? 'totp' : null,
            remaining_recovery_codes: unusedCodes.length
        });
    } catch (e) {
        console.error('MFA status error:', e);
        res.status(500).json({ error: 'Server error fetching MFA status' });
    }
});

// 2. POST /api/auth/mfa/enroll - Initiate enrollment with password re-authentication
app.post(['/api/auth/mfa/enroll', '/auth/mfa/enroll'], authenticateToken, async (req, res) => {
    const { current_password } = req.body;
    if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to enable Two-Factor Authentication' });
    }

    try {
        const user = await db.get('users', req.user.id);
        if (!user) return res.status(500).json({ error: 'User record not found' });

        const validPassword = await bcrypt.compare(current_password, user.password);
        if (!validPassword) {
            mfaService.logAuditEvent(db, {
                userId: user.id,
                event: 'MFA_ENROLL_FAILED',
                status: 'FAILED',
                req,
                details: { reason: 'Incorrect current password' }
            });
            return res.status(401).json({ error: 'Incorrect password. Re-authentication failed.' });
        }

        const secret = mfaService.generateTotpSecret();
        const encryptedSecret = mfaService.encryptSecret(secret);
        const otpAuthUri = mfaService.getOtpAuthUri(user.email, secret);
        const qrCodeDataUrl = await mfaService.generateQrCodeDataUrl(otpAuthUri);
        const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minute enrollment window

        // Store or replace pending enrollment
        const existingPending = await db.findOne('mfa_pending_enrollments', [{ field: 'user_id', op: '==', value: String(user.id) }]);
        if (existingPending) {
            await db.update('mfa_pending_enrollments', existingPending.id, {
                secret_encrypted: encryptedSecret,
                expires_at: expiresAt
            });
        } else {
            await db.insert('mfa_pending_enrollments', {
                user_id: String(user.id),
                secret_encrypted: encryptedSecret,
                expires_at: expiresAt
            });
        }

        mfaService.logAuditEvent(db, {
            userId: user.id,
            event: 'MFA_ENROLL_INITIATED',
            status: 'SUCCESS',
            req
        });

        res.json({
            secret,
            qr_code: qrCodeDataUrl,
            otpauth_url: otpAuthUri,
            expires_in: 600
        });
    } catch (e) {
        console.error('Error generating MFA enrollment:', e);
        res.status(500).json({ error: 'Error generating MFA configuration' });
    }
});

// 3. POST /api/auth/mfa/confirm-enrollment - Verify 6-digit code and activate MFA
app.post(['/api/auth/mfa/confirm-enrollment', '/auth/mfa/confirm-enrollment'], authenticateToken, async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: '6-digit authenticator code is required' });
    }

    try {
        const pending = await db.findOne('mfa_pending_enrollments', [
            { field: 'user_id', op: '==', value: String(req.user.id) }
        ]);

        if (!pending || Date.now() > pending.expires_at) {
            return res.status(400).json({ error: 'No active enrollment session found or session has expired. Please start over.' });
        }

        const plainSecret = mfaService.decryptSecret(pending.secret_encrypted);
        if (!plainSecret) {
            return res.status(500).json({ error: 'Failed to decrypt pending MFA secret on server' });
        }

        const verifyResult = mfaService.verifyTotpCode(code, plainSecret, 0);
        if (!verifyResult.valid) {
            mfaService.logAuditEvent(db, {
                userId: req.user.id,
                event: 'MFA_ENROLL_CONFIRM_FAILED',
                status: 'FAILED',
                req,
                details: { reason: verifyResult.reason }
            });
            return res.status(400).json({ error: verifyResult.reason || 'Invalid code. Check your authenticator app.' });
        }

        // Generate 8 backup recovery codes
        const { plainCodes, hashedCodes } = mfaService.generateRecoveryCodes(8);

        // Update user in Firestore
        await db.update('users', req.user.id, {
            mfa_enabled: '1',
            mfa_secret_encrypted: pending.secret_encrypted,
            mfa_enrolled_at: new Date().toISOString(),
            mfa_last_totp_step: 0
        });

        // Delete pending enrollment
        await db.delete('mfa_pending_enrollments', pending.id);

        // Clear existing recovery codes for user
        const oldCodes = await db.find('mfa_recovery_codes', [{ field: 'user_id', op: '==', value: String(req.user.id) }]);
        for (const old of oldCodes) {
            await db.delete('mfa_recovery_codes', old.id);
        }

        // Store fresh hashed recovery codes
        for (const rc of hashedCodes) {
            await db.insert('mfa_recovery_codes', {
                user_id: String(req.user.id),
                code_hash: rc.code_hash,
                salt: rc.salt,
                used: 0
            });
        }

        mfaService.logAuditEvent(db, {
            userId: req.user.id,
            event: 'MFA_ENROLLED',
            status: 'SUCCESS',
            req
        });

        res.json({
            success: true,
            message: 'Two-Factor Authentication is now successfully enabled on your account.',
            recovery_codes: plainCodes
        });
    } catch (e) {
        console.error('Confirmation error:', e);
        res.status(500).json({ error: 'Server error confirming MFA enrollment' });
    }
});

// 4. POST /api/auth/mfa/verify - Verify challenge (TOTP, recovery code, or email OTP)
app.post(['/api/auth/mfa/verify', '/auth/mfa/verify'], async (req, res) => {
    const { mfa_token, code, method = 'totp' } = req.body;
    if (!mfa_token || !code) {
        return res.status(400).json({ error: 'MFA challenge token and verification code are required' });
    }

    jwt.verify(mfa_token, SECRET_KEY, async (jwtErr, decoded) => {
        if (jwtErr || !decoded || decoded.purpose !== 'mfa_challenge') {
            return res.status(401).json({ error: 'Invalid or expired MFA challenge token. Please login again.' });
        }

        const { challengeId, userId } = decoded;
        const rateKey = `mfa_verify_${userId}`;
        const rateCheck = mfaService.checkRateLimit(rateKey);
        if (!rateCheck.allowed) {
            return res.status(429).json({ error: rateCheck.message });
        }

        try {
            const challenge = await db.findOne('mfa_challenges', [
                { field: 'challenge_id', op: '==', value: challengeId },
                { field: 'user_id', op: '==', value: String(userId) }
            ]);

            if (!challenge) {
                return res.status(400).json({ error: 'Challenge not found or invalid. Please login again.' });
            }
            if (challenge.consumed === 1) {
                return res.status(400).json({ error: 'This challenge has already been consumed. Please login again.' });
            }
            if (Date.now() > challenge.expires_at) {
                return res.status(400).json({ error: 'Verification challenge has expired. Please login again.' });
            }
            if (challenge.attempts_left <= 0) {
                return res.status(429).json({ error: 'Maximum verification attempts exceeded. Please login again.' });
            }

            const user = await db.get('users', userId);
            if (!user) return res.status(400).json({ error: 'User account not found' });

            const handleFailure = async (errMsg, eventType = 'MFA_VERIFY_FAILED') => {
                const newAttempts = challenge.attempts_left - 1;
                await db.update('mfa_challenges', challenge.id, { attempts_left: newAttempts });
                mfaService.recordFailedAttempt(rateKey);
                mfaService.logAuditEvent(db, {
                    userId: user.id,
                    event: eventType,
                    status: 'FAILED',
                    req,
                    details: { method, reason: errMsg, attempts_left: newAttempts }
                });
                return res.status(400).json({
                    error: errMsg,
                    attempts_left: Math.max(0, newAttempts)
                });
            };

            const handleSuccess = async (eventType = 'MFA_VERIFY_SUCCESS') => {
                await db.update('mfa_challenges', challenge.id, { consumed: 1 });
                mfaService.resetRateLimit(rateKey);
                mfaService.logAuditEvent(db, {
                    userId: user.id,
                    event: eventType,
                    status: 'SUCCESS',
                    req,
                    details: { method }
                });

                const sessionToken = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET_KEY);
                return res.json({
                    token: sessionToken,
                    user: { id: user.id, name: user.name, email: user.email }
                });
            };

            // Method A: TOTP authenticator app
            if (method === 'totp') {
                if (!user.mfa_secret_encrypted) {
                    return handleFailure('TOTP authenticator is not configured on this account');
                }
                const plainSecret = mfaService.decryptSecret(user.mfa_secret_encrypted);
                if (!plainSecret) {
                    return res.status(500).json({ error: 'Failed to decrypt TOTP secret on server' });
                }
                const result = mfaService.verifyTotpCode(code, plainSecret, user.mfa_last_totp_step || 0);
                if (!result.valid) {
                    return handleFailure(result.reason || 'Invalid authenticator code');
                }

                await db.update('users', user.id, { mfa_last_totp_step: result.timeStep });
                return handleSuccess('MFA_VERIFY_SUCCESS');
            }
            // Method B: One-time recovery code
            else if (method === 'recovery_code') {
                const activeCodes = await db.find('mfa_recovery_codes', [
                    { field: 'user_id', op: '==', value: String(user.id) },
                    { field: 'used', op: '==', value: 0 }
                ]);

                const matchedId = mfaService.verifyRecoveryCode(activeCodes, code);
                if (!matchedId) {
                    return handleFailure('Invalid or already-used recovery code', 'MFA_RECOVERY_CODE_FAILED');
                }

                await db.update('mfa_recovery_codes', matchedId, {
                    used: 1,
                    used_at: new Date().toISOString()
                });
                return handleSuccess('MFA_RECOVERY_CODE_USED');
            }
            // Method C: Email OTP
            else if (method === 'email_otp') {
                const normalizedOtp = String(code).replace(/\s+/g, '').trim();
                const pendingOtps = await db.find('mfa_email_otps', [
                    { field: 'user_id', op: '==', value: String(user.id) },
                    { field: 'challenge_id', op: '==', value: challenge.challenge_id },
                    { field: 'consumed', op: '==', value: 0 }
                ]);

                const otpRecord = pendingOtps.length > 0 ? pendingOtps[pendingOtps.length - 1] : null;
                if (!otpRecord) {
                    return handleFailure('No pending email OTP found. Please request a new code.');
                }
                if (Date.now() > otpRecord.expires_at) {
                    return handleFailure('Email OTP has expired. Please request a new code.');
                }
                if (otpRecord.attempts_left <= 0) {
                    return handleFailure('Maximum attempts for this email OTP exceeded.');
                }

                const computedHash = crypto.createHash('sha256').update(`${normalizedOtp}:${otpRecord.salt}`).digest('hex');
                if (computedHash !== otpRecord.otp_hash) {
                    await db.update('mfa_email_otps', otpRecord.id, { attempts_left: otpRecord.attempts_left - 1 });
                    return handleFailure('Invalid email OTP code', 'MFA_EMAIL_OTP_FAILED');
                }

                await db.update('mfa_email_otps', otpRecord.id, { consumed: 1 });
                return handleSuccess('MFA_EMAIL_OTP_VERIFIED');
            } else {
                return res.status(400).json({ error: `Unsupported verification method: ${method}` });
            }
        } catch (e) {
            console.error('Verify error:', e);
            res.status(500).json({ error: 'Server database error during verification' });
        }
    });
});

// 5. POST /api/auth/mfa/disable - Disable MFA after re-authentication & verification
app.post(['/api/auth/mfa/disable', '/auth/mfa/disable'], authenticateToken, async (req, res) => {
    const { current_password, code } = req.body;
    if (!current_password || !code) {
        return res.status(400).json({ error: 'Password and current authenticator code are required to disable MFA' });
    }

    try {
        const user = await db.get('users', req.user.id);
        if (!user) return res.status(500).json({ error: 'User not found' });
        if (!user.mfa_enabled) {
            return res.status(400).json({ error: 'MFA is not currently enabled on this account' });
        }

        const validPassword = await bcrypt.compare(current_password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const plainSecret = mfaService.decryptSecret(user.mfa_secret_encrypted);
        const totpResult = plainSecret ? mfaService.verifyTotpCode(code, plainSecret, 0) : { valid: false };

        const recoveryCodes = await db.find('mfa_recovery_codes', [
            { field: 'user_id', op: '==', value: String(user.id) },
            { field: 'used', op: '==', value: 0 }
        ]);
        const matchedRecoveryId = mfaService.verifyRecoveryCode(recoveryCodes, code);
        const isCodeValid = totpResult.valid || Boolean(matchedRecoveryId);

        if (!isCodeValid) {
            mfaService.logAuditEvent(db, {
                userId: user.id,
                event: 'MFA_DISABLE_FAILED',
                status: 'FAILED',
                req,
                details: { reason: 'Invalid second factor' }
            });
            return res.status(400).json({ error: 'Invalid authenticator or recovery code' });
        }

        await db.update('users', user.id, {
            mfa_enabled: '0',
            mfa_secret_encrypted: null,
            mfa_enrolled_at: null,
            mfa_last_totp_step: 0
        });

        for (const rc of recoveryCodes) {
            await db.delete('mfa_recovery_codes', rc.id);
        }

        mfaService.logAuditEvent(db, {
            userId: user.id,
            event: 'MFA_DISABLED',
            status: 'SUCCESS',
            req
        });

        res.json({
            success: true,
            message: 'Two-Factor Authentication has been successfully disabled.'
        });
    } catch (e) {
        console.error('Disable MFA error:', e);
        res.status(500).json({ error: 'Server error disabling MFA' });
    }
});

// 6. POST /api/auth/mfa/recovery-codes/regenerate - Invalidate and regenerate recovery codes
app.post(['/api/auth/mfa/recovery-codes/regenerate', '/auth/mfa/recovery-codes/regenerate'], authenticateToken, async (req, res) => {
    const { current_password, code } = req.body;
    if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to regenerate recovery codes' });
    }

    try {
        const user = await db.get('users', req.user.id);
        if (!user) return res.status(500).json({ error: 'User not found' });
        if (!user.mfa_enabled) {
            return res.status(400).json({ error: 'MFA is not enabled on this account' });
        }

        const validPassword = await bcrypt.compare(current_password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        if (code) {
            const plainSecret = mfaService.decryptSecret(user.mfa_secret_encrypted);
            const totpResult = mfaService.verifyTotpCode(code, plainSecret, 0);
            if (!totpResult.valid) {
                return res.status(400).json({ error: 'Invalid authenticator code' });
            }
        }

        const { plainCodes, hashedCodes } = mfaService.generateRecoveryCodes(8);

        const oldCodes = await db.find('mfa_recovery_codes', [{ field: 'user_id', op: '==', value: String(user.id) }]);
        for (const old of oldCodes) {
            await db.delete('mfa_recovery_codes', old.id);
        }

        for (const rc of hashedCodes) {
            await db.insert('mfa_recovery_codes', {
                user_id: String(user.id),
                code_hash: rc.code_hash,
                salt: rc.salt,
                used: 0
            });
        }

        mfaService.logAuditEvent(db, {
            userId: user.id,
            event: 'MFA_RECOVERY_CODES_REGENERATED',
            status: 'SUCCESS',
            req
        });

        res.json({
            success: true,
            message: 'Fresh recovery codes generated. All previous recovery codes are now invalid.',
            recovery_codes: plainCodes
        });
    } catch (e) {
        console.error('Regenerate codes error:', e);
        res.status(500).json({ error: 'Server error regenerating recovery codes' });
    }
});

// 7. POST /api/auth/mfa/email-otp/send - Dispatches an email OTP challenge
app.post(['/api/auth/mfa/email-otp/send', '/auth/mfa/email-otp/send'], async (req, res) => {
    const { mfa_token } = req.body;
    if (!mfa_token) {
        return res.status(400).json({ error: 'MFA challenge token is required' });
    }

    jwt.verify(mfa_token, SECRET_KEY, async (err, decoded) => {
        if (err || !decoded || decoded.purpose !== 'mfa_challenge') {
            return res.status(401).json({ error: 'Invalid or expired challenge token' });
        }

        try {
            const challenge = await db.findOne('mfa_challenges', [
                { field: 'challenge_id', op: '==', value: decoded.challengeId },
                { field: 'user_id', op: '==', value: String(decoded.userId) }
            ]);

            if (!challenge || challenge.consumed === 1 || Date.now() > challenge.expires_at) {
                return res.status(400).json({ error: 'Challenge expired or invalid' });
            }

            const user = await db.get('users', decoded.userId);
            if (!user) return res.status(400).json({ error: 'User not found' });

            const otp = String(crypto.randomInt(100000, 999999));
            const salt = crypto.randomBytes(16).toString('hex');
            const otpHash = crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
            const expiresAt = Date.now() + (5 * 60 * 1000);

            await db.insert('mfa_email_otps', {
                user_id: String(user.id),
                challenge_id: challenge.challenge_id,
                otp_hash: otpHash,
                salt: salt,
                attempts_left: 3,
                expires_at: expiresAt,
                consumed: 0
            });

            const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
            if (smtpConfigured) {
                console.log(`[MFA Email Service] Sent OTP to ${user.email}`);
            } else {
                console.log(`[MFA Email Service] SMTP not configured. Development OTP for ${user.email} is: [${otp}]`);
            }

            mfaService.logAuditEvent(db, {
                userId: user.id,
                event: 'MFA_EMAIL_OTP_DISPATCHED',
                status: 'SUCCESS',
                req
            });

            res.json({
                success: true,
                message: `Verification code sent to ${mfaService.maskEmail(user.email)}`,
                smtp_configured: smtpConfigured
            });
        } catch (e) {
            console.error('Email OTP send error:', e);
            res.status(500).json({ error: 'Server error sending email OTP' });
        }
    });
});

// 8. GET /api/auth/mfa/audit-logs - View recent security events for user
app.get(['/api/auth/mfa/audit-logs', '/auth/mfa/audit-logs'], authenticateToken, async (req, res) => {
    try {
        const logs = await db.find('mfa_audit_logs', [
            { field: 'user_id', op: '==', value: String(req.user.id) }
        ], { orderBy: 'created_at', orderDir: 'desc', limit: 15 });

        res.json({ audit_logs: logs || [] });
    } catch (e) {
        console.error('Audit logs error:', e);
        res.status(500).json({ error: 'Error fetching audit logs' });
    }
});

// ========================================================
// TRIPS & COMMUNITY APIS (FIRESTORE)
// ========================================================

// API: Create Trip
app.post('/api/trips', authenticateToken, async (req, res) => {
    const { destination, dates, budget, itinerary } = req.body;
    const userId = String(req.user.id);
    try {
        const newTrip = await db.insert('trips', {
            user_id: userId,
            destination,
            dates,
            budget,
            itinerary: itinerary || null
        });
        res.json(newTrip);
    } catch (e) {
        console.error('Create trip error:', e);
        res.status(500).json({ error: 'Database error creating trip' });
    }
});

// API: Get My Trips
app.get('/api/trips', authenticateToken, async (req, res) => {
    const userId = String(req.user.id);
    try {
        const trips = await db.find('trips', [{ field: 'user_id', op: '==', value: userId }], { orderBy: 'created_at', orderDir: 'desc' });
        res.json(trips);
    } catch (e) {
        console.error('Get trips error:', e);
        res.status(500).json({ error: 'Database error fetching trips' });
    }
});

// API: Update Trip
app.put('/api/trips/:id', authenticateToken, async (req, res) => {
    const { destination, dates, budget, itinerary } = req.body;
    const tripId = req.params.id;
    try {
        const updated = await db.update('trips', tripId, { destination, dates, budget, itinerary });
        if (!updated) return res.status(404).json({ error: 'Trip not found or unauthorized' });
        res.json({ success: true, trip: updated });
    } catch (e) {
        console.error('Update trip error:', e);
        res.status(500).json({ error: 'Database error updating trip' });
    }
});

// API: Delete Trip
app.delete('/api/trips/:id', authenticateToken, async (req, res) => {
    const tripId = req.params.id;
    try {
        await db.delete('trips', tripId);
        res.json({ success: true, deletedId: tripId });
    } catch (e) {
        console.error('Delete trip error:', e);
        res.status(500).json({ error: 'Database error deleting trip' });
    }
});

// API: Get Community Posts
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await db.find('posts', [], { orderBy: 'created_at', orderDir: 'desc', limit: 50 });
        res.json(posts);
    } catch (e) {
        res.status(500).json({ error: 'Database error fetching posts' });
    }
});

// API: Create Community Post
app.post('/api/posts', authenticateToken, async (req, res) => {
    const { content, author_name } = req.body;
    try {
        const newPost = await db.insert('posts', {
            user_id: String(req.user.id),
            author_name: author_name || req.user.name || 'Traveler',
            content,
            timestamp: new Date().toISOString()
        });
        res.json({ success: true, id: newPost.id, post: newPost });
    } catch (e) {
        res.status(500).json({ error: 'Database error creating post' });
    }
});

// API: Get Hidden Gems
app.get('/api/hidden-gems', async (req, res) => {
    const { country, category } = req.query;
    try {
        const conditions = [];
        if (country) conditions.push({ field: 'country', op: '==', value: country });
        if (category) conditions.push({ field: 'category', op: '==', value: category });
        const gems = await db.find('hidden_gems', conditions, { orderBy: 'gem_score', orderDir: 'desc' });
        res.json(gems);
    } catch (e) {
        res.status(500).json({ error: 'Database error fetching hidden gems' });
    }
});

// API: Submit Hidden Gem
app.post('/api/hidden-gems', async (req, res) => {
    const {
        name, city, country, category, description,
        rating = 4.8, crowd_level = "Low", budget = "₹100 - ₹500",
        best_time = "Morning", distance = "15 min", photo_url, submitted_by
    } = req.body;

    if (!name || !city || !country || !description) {
        return res.status(400).json({ error: 'Name, city, country, and description are required' });
    }

    try {
        const uniqueness_score = Math.floor(Math.random() * 11) + 89;
        const crowd_score = Math.floor(Math.random() * 11) + 88;
        const vibe_score = Math.floor(Math.random() * 11) + 90;
        const gem_score = Math.round((uniqueness_score * 0.4) + (crowd_score * 0.3) + (vibe_score * 0.3));

        const gem = await db.insert('hidden_gems', {
            name, city, country, category: category || 'Secret Viewpoint', description,
            gem_score, rating: parseFloat(rating), crowd_level, budget, best_time, distance,
            photo_url: photo_url || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
            submitted_by: submitted_by || "Community Traveler",
            uniqueness_score, crowd_score, vibe_score
        });

        res.json({ success: true, id: gem.id, gem_score });
    } catch (e) {
        res.status(500).json({ error: 'Failed to submit gem' });
    }
});

// API: AI Travel Assistant Chat (Gemini 3.8 Flash Powered with Smart Local Fallback)
app.post('/api/ai-chat', async (req, res) => {
    const { message, history = [], currentTrip } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    if (process.env.GEMINI_API_KEY) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const systemInstruction = `You are TripoNext AI, an expert, enthusiastic personal travel assistant. 
Help travelers with personalized recommendations, secret viewpoints, budget tips, authentic local eateries, packing essentials, and weather guidance. Keep answers friendly, concise, and structured with emojis and bullet points.`;
            
            const prompt = `${systemInstruction}\n\nUser Question: ${message}`;
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt
            });
            return res.json({ reply: response.text });
        } catch (e) {
            console.warn('Gemini chat error, using local fallback assistant:', e.message);
        }
    }

    const lower = message.toLowerCase();
    if (lower.includes('budget') || lower.includes('cost') || lower.includes('money')) {
        return res.json({ reply: "💡 **TripoNext Budget Pro-Tip:** Split stays using our MyTrips Expense Splitter, book trains or shared outstation cabs, and opt for boutique heritage homestays to save up to 40%!" });
    } else if (lower.includes('packing') || lower.includes('pack')) {
        return res.json({ reply: "🎒 **Essential Travel Packing Checklist:**\n• Portable power bank & universal adapter\n• Lightweight waterproof jacket\n• Comfortable trail walking shoes\n• Offline downloaded maps & emergency documents" });
    } else {
        return res.json({ reply: `✨ Here are top recommendations for you! I recommend exploring early in the morning to beat the crowds, asking locals for secret food joints, and downloading your itinerary for offline mode.` });
    }
});

// API: AI Itinerary Generator (Gemini + Smart Authentic Travel Planner Engine)
app.post('/api/ai-itinerary', async (req, res) => {
    const { destination, days = 3, budget = 15000, currency = "INR", travelers = 1, style = "Balanced" } = req.body;
    if (!destination) return res.status(400).json({ error: 'Destination is required' });
    const numDays = Math.min(Math.max(parseInt(days) || 3, 1), 7);

    if (process.env.GEMINI_API_KEY) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const prompt = `Generate a realistic and exciting ${numDays}-day travel itinerary for ${destination}.
Travel style: ${style}, Travelers: ${travelers}, Total Budget: ${currency} ${budget}.
Include actual famous landmarks, authentic local food specialties, and realistic morning/afternoon/evening schedule.
Return strictly valid JSON only without markdown or backticks in this exact schema:
{
  "destination": "${destination}",
  "days": ${numDays},
  "summary": "Brief 2-line exciting summary of the trip",
  "vibe": "Adventure / Cultural / Relaxed / Romantic",
  "budgetBreakdown": { "stay": "estimated amount", "food": "estimated amount", "activities": "estimated amount", "transport": "estimated amount" },
  "packingList": ["item 1", "item 2", "item 3", "item 4"],
  "insiderTips": ["tip 1", "tip 2", "tip 3"],
  "dailyPlan": [
    {
      "day": 1,
      "theme": "Day theme (e.g. Arrival, Old Town Vibe & Sunset Eats)",
      "morning": { "time": "09:00 AM", "activity": "Name of morning spot/activity", "location": "Exact landmark", "tip": "Insider morning tip" },
      "afternoon": { "time": "01:30 PM", "activity": "Name of lunch & afternoon activity", "location": "Exact landmark", "tip": "Food or crowd tip" },
      "evening": { "time": "06:30 PM", "activity": "Sunset/night activity or dining", "location": "Exact landmark", "tip": "Evening vibe tip" }
    }
  ]
}`;
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt
            });
            let cleanText = response.text.trim();
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
            }
            const parsed = JSON.parse(cleanText);
            return res.json(parsed);
        } catch (e) {
            console.warn('Gemini itinerary generation fallback to engine:', e.message);
        }
    }

    const dynamicPlan = generateDynamicPlan(destination, numDays, budget, currency, travelers, style);
    res.json(dynamicPlan);
});

// API: Get Buddy Messages / Chats
app.get('/api/messages', async (req, res) => {
    const { buddy } = req.query;
    try {
        let conditions = [];
        if (buddy) {
            conditions.push({ field: 'receiver_name', op: '==', value: buddy });
        }
        const messages = await db.find('buddy_messages', conditions, { orderBy: 'timestamp', orderDir: 'asc', limit: 100 });
        res.json(messages);
    } catch (e) {
        res.status(500).json({ error: 'Database error fetching messages' });
    }
});

// API: Send Buddy Message
app.post('/api/messages', async (req, res) => {
    const { sender_name = "You", receiver_name, trip_destination, message } = req.body;
    if (!message || !receiver_name) return res.status(400).json({ error: 'Message and receiver are required' });

    try {
        const newMsg = await db.insert('buddy_messages', {
            sender_id: "1",
            sender_name,
            receiver_name,
            trip_destination: trip_destination || "Trip",
            message,
            timestamp: new Date().toISOString()
        });

        const autoReplies = {
            "Rahul S.": "Hey! Thanks for messaging. We have 2 spots left for Manali. Are you comfortable with a road trip from Delhi?",
            "Ananya D.": "Awesome! We're doing Gokarna next month. Let me know if you prefer beach hostel or private room!",
            "Vikram R.": "Spiti requires heavy winter jackets! Let me know if you have road-trip experience.",
            "Priya M.": "Udaipur is magical! We booked a heritage haveli near Lake Pichola. Super happy to have you join!"
        };

        res.json({ success: true, id: newMsg.id, message: newMsg });

        if (autoReplies[receiver_name] && sender_name === "You") {
            setTimeout(async () => {
                await db.insert('buddy_messages', {
                    sender_id: "2",
                    sender_name: receiver_name,
                    receiver_name: "You",
                    trip_destination: trip_destination || "Trip",
                    message: autoReplies[receiver_name],
                    timestamp: new Date().toISOString()
                });
            }, 1200);
        }
    } catch (e) {
        res.status(500).json({ error: 'Database error saving message' });
    }
});

// API: Get Trip Expenses
app.get('/api/trips/:id/expenses', async (req, res) => {
    const tripId = req.params.id;
    try {
        const expenses = await db.find('trip_expenses', [{ field: 'trip_id', op: '==', value: String(tripId) }], { orderBy: 'created_at', orderDir: 'desc' });
        res.json(expenses);
    } catch (e) {
        res.status(500).json({ error: 'Database error fetching expenses' });
    }
});

// API: Add Trip Expense
app.post('/api/trips/:id/expenses', async (req, res) => {
    const tripId = req.params.id;
    const { paid_by, amount, description, category, split_with, date } = req.body;
    if (!paid_by || !amount || !description) return res.status(400).json({ error: 'Missing required fields' });

    try {
        const newExp = await db.insert('trip_expenses', {
            trip_id: String(tripId),
            user_id: "1",
            paid_by,
            amount: parseFloat(amount),
            description,
            category: category || "General",
            split_with: split_with || "All",
            date: date || new Date().toISOString().split('T')[0]
        });
        res.json({ success: true, id: newExp.id, expense: newExp });
    } catch (e) {
        res.status(500).json({ error: 'Database error saving expense' });
    }
});

// API: Delete Trip Expense
app.delete('/api/trips/:id/expenses/:expId', async (req, res) => {
    const { expId } = req.params;
    try {
        await db.delete('trip_expenses', expId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Database error deleting expense' });
    }
});

// API: Get Trip Photos
app.get('/api/photos', async (req, res) => {
    try {
        const photos = await db.find('trip_photos', [], { orderBy: 'created_at', orderDir: 'desc', limit: 50 });
        res.json(photos);
    } catch (e) {
        res.status(500).json({ error: 'Database error fetching photos' });
    }
});

// API: Post Trip Photo
app.post('/api/photos', async (req, res) => {
    const { author_name = "You", destination, caption, photo_url } = req.body;
    if (!destination || !photo_url) return res.status(400).json({ error: 'Destination and photo URL are required' });

    try {
        const photo = await db.insert('trip_photos', {
            user_id: "1",
            author_name,
            destination,
            caption: caption || "Unforgettable trip moments!",
            photo_url,
            likes: 0
        });
        res.json({ success: true, id: photo.id, photo });
    } catch (e) {
        res.status(500).json({ error: 'Database error saving photo' });
    }
});

// API: Like Trip Photo
app.post('/api/photos/:id/like', async (req, res) => {
    const photoId = req.params.id;
    try {
        const existing = await db.get('trip_photos', photoId);
        if (existing) {
            await db.update('trip_photos', photoId, { likes: (existing.likes || 0) + 1 });
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Database error updating likes' });
    }
});

// API: Get Notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const notifs = await db.find('notifications', [], { orderBy: 'created_at', orderDir: 'desc', limit: 20 });
        res.json(notifs);
    } catch (e) {
        res.status(500).json({ error: 'Database error fetching notifications' });
    }
});

// API: Mark Notifications Read
app.post('/api/notifications/read-all', async (req, res) => {
    try {
        const notifs = await db.find('notifications', [{ field: 'is_read', op: '==', value: 0 }]);
        for (const n of notifs) {
            await db.update('notifications', n.id, { is_read: 1 });
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Database error updating notifications' });
    }
});

// API: User Profile & Referrals
app.get('/api/user/profile', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token || token.startsWith('guest-token') || token.startsWith('local-token')) {
        return res.json({
            id: "1",
            name: "Rahul Sharma",
            email: "rahul.traveler@triponext.com",
            phone: "+91 98765 43210",
            bio: "Passionate road-tripper, mountain lover & culture explorer.",
            avatar: "avatar-1",
            home_city: "Delhi, India",
            travel_style: "Adventure & Cultural",
            referral_code: "TRIP-7492",
            referral_credits: 500
        });
    }

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
        if (err || !decoded) {
            return res.json({
                id: "1",
                name: "Rahul Sharma",
                email: "rahul.traveler@triponext.com",
                phone: "+91 98765 43210",
                bio: "Passionate road-tripper, mountain lover & culture explorer.",
                avatar: "avatar-1",
                home_city: "Delhi, India",
                travel_style: "Adventure & Cultural",
                referral_code: "TRIP-7492",
                referral_credits: 500
            });
        }
        try {
            const user = await db.get('users', decoded.id);
            if (!user) {
                return res.json({
                    id: decoded.id,
                    name: decoded.name || "Rahul Sharma",
                    email: decoded.email,
                    phone: "+91 98765 43210",
                    bio: "Wanderlust-driven explorer discovering secret gems.",
                    avatar: "avatar-1",
                    home_city: "Delhi, India",
                    travel_style: "Balanced",
                    referral_code: "TRIP-" + (String(decoded.id).slice(-4) || '7492'),
                    referral_credits: 500
                });
            }
            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone || "+91 98765 43210",
                bio: user.bio || "Wanderlust-driven explorer discovering secret gems.",
                avatar: user.avatar || "avatar-1",
                home_city: user.home_city || "Delhi, India",
                travel_style: user.travel_style || "Balanced",
                referral_code: user.referral_code || ("TRIP-" + (String(user.id).slice(-4) || '7492')),
                referral_credits: user.referral_credits || 500
            });
        } catch (e) {
            res.status(500).json({ error: 'Database error reading profile' });
        }
    });
});

app.put('/api/user/profile', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const { name, phone, bio, avatar, home_city, travel_style } = req.body;

    if (!token || token.startsWith('guest-token') || token.startsWith('local-token')) {
        return res.json({ success: true, message: "Profile saved successfully", user: req.body });
    }

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
        if (err || !decoded) {
            return res.json({ success: true, message: "Profile saved successfully", user: req.body });
        }
        try {
            await db.update('users', decoded.id, {
                ...(name ? { name } : {}),
                phone, bio, avatar, home_city, travel_style
            });
            res.json({ success: true, user: { id: decoded.id, name, phone, bio, avatar, home_city, travel_style } });
        } catch (dbErr) {
            res.status(500).json({ error: 'Database update failed' });
        }
    });
});

app.get('/api/user/referrals', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = "1";
    if (token) {
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            userId = decoded.id;
        } catch(e) {}
    }

    const refCode = "TRIP-" + (String(userId).slice(-4) || "7492");
    res.json({
        referral_code: refCode,
        share_url: `https://triponext.com/join?ref=${refCode}`,
        referral_credits: 500,
        currency: "₹",
        per_invite_bonus: 250,
        friends_invited: 2,
        invited_list: [
            { name: "Aarav Sharma", status: "Joined & Booked", reward: "+₹250", date: "2 days ago" },
            { name: "Pooja Verma", status: "Registered", reward: "+₹250", date: "Last week" }
        ]
    });
});

// API: Feedback & Ratings
app.post('/api/feedback', async (req, res) => {
    const { name, rating, category, comment } = req.body;
    if (!rating) return res.status(400).json({ error: 'Rating is required' });

    try {
        const item = await db.insert('feedback_reviews', {
            user_name: name || 'Anonymous Traveler',
            rating: parseInt(rating),
            category: category || 'General App',
            comment: comment || ''
        });
        res.json({ success: true, id: item.id, message: 'Thank you for your valuable feedback and rating!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

app.get('/api/feedback', async (req, res) => {
    try {
        const reviews = await db.find('feedback_reviews', [], { orderBy: 'created_at', orderDir: 'desc', limit: 20 });
        res.json(reviews || []);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// API: Offers & Discounts
app.get('/api/offers', (req, res) => {
    const offers = [
        {
            code: 'AIRFLY25',
            title: 'Flat 25% OFF Flights',
            desc: 'Save up to ₹2,500 on all domestic & international flight tickets.',
            type: 'flight',
            discount: '25% OFF',
            minBooking: '₹4,000',
            expiry: 'Valid till 30 Nov'
        },
        {
            code: 'STAYLUXE',
            title: 'Flat ₹1,500 OFF Hotels',
            desc: 'Applicable on 4-star & 5-star resorts, boutique hotels and homestays.',
            type: 'hotel',
            discount: '₹1,500 OFF',
            minBooking: '₹3,500',
            expiry: 'Valid till 15 Dec'
        },
        {
            code: 'CABSAFE',
            title: '20% OFF Airport & Cabs',
            desc: 'Get instant 20% discount on Sedan and SUV intercity outstation rides.',
            type: 'cab',
            discount: '20% OFF',
            minBooking: '₹300',
            expiry: 'Always Active'
        },
        {
            code: 'BUSWAY150',
            title: 'Flat ₹150 OFF AC Volvo Buses',
            desc: 'Save on long-distance Volvo, BharatBenz & electric sleeper bus seats.',
            type: 'bus',
            discount: '₹150 OFF',
            minBooking: '₹600',
            expiry: 'Valid this month'
        },
        {
            code: 'TRIPNEXT500',
            title: 'Welcome Bonus: ₹500 Instant Credit',
            desc: 'Special new user welcome voucher applicable across all transit & hotel bookings.',
            type: 'general',
            discount: '₹500 OFF',
            minBooking: '₹1,000',
            expiry: 'Lifetime for New Users'
        }
    ];
    res.json({ count: offers.length, offers });
});

// API: Help & Support FAQs
app.get('/api/support/faqs', (req, res) => {
    const faqs = [
        {
            q: "How do I cancel or reschedule my hotel or flight booking?",
            a: "Go to Profile > My Trips or Bookings Hub, select the booking, and tap 'Cancel Booking'. Free cancellations are processed automatically within 2-4 business days."
        },
        {
            q: "How does the Offline Mode work without internet?",
            a: "When you have internet, tap 'Save for Offline' on any itinerary in Dashboard or My Trips. The app stores all details locally on your phone so you can navigate without WiFi or cellular data."
        },
        {
            q: "How does the Refer and Earn program reward me?",
            a: "Share your unique referral code with friends. When they sign up and plan or book their first adventure, both of you receive ₹250 wallet credits instantly."
        },
        {
            q: "Can I connect and chat with verified travel buddies?",
            a: "Yes! Use the 'Find Buddies' section. All verified organizers have blue checkmarks. You can chat directly, split fuel or stays, and share trip photos on the Community wall."
        },
        {
            q: "How do I clear cached offline trips if old data is showing?",
            a: "Open Settings > Offline Manager, and click 'Clear Offline Cache'. This purges all old cached records and syncs freshly with the cloud."
        }
    ];
    res.json({ faqs });
});

// API: Record Support Ticket
app.post('/api/support/ticket', async (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    try {
        const ticketRef = "TKT-" + Math.floor(100000 + Math.random() * 900000);
        const ticket = await db.insert('support_tickets', {
            user_name: name || 'Traveler',
            user_email: email || 'user@example.com',
            subject: subject || 'Help Request',
            message,
            status: 'Open',
            ticket_ref: ticketRef
        });

        res.json({
            success: true,
            ticket_id: ticket.id,
            ticket_ref: ticketRef,
            message: `Ticket ${ticketRef} created. Our travel support specialist will reply via email within 2-4 hours.`
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to record support ticket' });
    }
});

// Curated Hotel Catalog Fallback Data
const CURATED_HOTELS_DB = {
    "manali": [
        { id: "htl-mnl-1", name: "The Himalayan Resort & Spa", city: "Manali", rating: 4.8, reviewsCount: 380, pricePerNight: 5899, currency: "INR", stars: 5, tag: "Luxury Mountain Castle", amenities: ["Heated Swimming Pool", "Apple Orchard View", "Wood Fireplace", "Free WiFi"], address: "Hadimba Road, Siyal, Manali", photo_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-mnl-2", name: "Zostel Manali (Old Manali)", city: "Manali", rating: 4.7, reviewsCount: 890, pricePerNight: 999, currency: "INR", stars: 3, tag: "Backpacker & Nomad Hub", amenities: ["Co-working Cafe", "Live Acoustic Nights", "River View Garden", "Luggage Lockers"], address: "Manu Temple Road, Old Manali", photo_url: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80" }
    ],
    "goa": [
        { id: "htl-goa-1", name: "Taj Exotica Resort & Spa", city: "Goa", rating: 4.9, reviewsCount: 1250, pricePerNight: 12499, currency: "INR", stars: 5, tag: "Private White Beachfront", amenities: ["Private Beach Access", "Jiva Spa", "Golf Course", "Beachside Seafood Grill"], address: "Calwaddo, Benaulim, South Goa", photo_url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-goa-2", name: "W Goa (Vagator)", city: "Goa", rating: 4.8, reviewsCount: 920, pricePerNight: 14999, currency: "INR", stars: 5, tag: "Cliff Sunset & Rock Pool", amenities: ["Rock Pool Sunset Lounge", "Direct Beach Trail", "Infinity Pool", "WOOBAR Cocktails"], address: "Vagator Beach, Bardez, North Goa", photo_url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80" }
    ],
    "paris": [
        { id: "htl-par-1", name: "Hôtel Plaza Athénée", city: "Paris", rating: 4.9, reviewsCount: 890, pricePerNight: 28500, currency: "INR", stars: 5, tag: "Eiffel Tower Balcony View", amenities: ["Eiffel Tower Balcony", "Dior Spa", "Courtyard Garden", "Alain Ducasse Dining"], address: "25 Avenue Montaigne, 75008 Paris", photo_url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80" },
        { id: "htl-par-2", name: "CitizenM Paris Gare de Lyon", city: "Paris", rating: 4.7, reviewsCount: 1840, pricePerNight: 8999, currency: "INR", stars: 4, tag: "Boutique Design & Sky Lounge", amenities: ["CloudM Rooftop Bar", "MoodPad Smart Rooms", "24/7 Food & Drinks", "High-speed WiFi"], address: "8 Rue Van Gogh, 75012 Paris", photo_url: "https://images.unsplash.com/photo-1568495248636-6432b97bd949?auto=format&fit=crop&w=800&q=80" }
    ]
};

// API: Search Hotels
app.get('/api/bookings/hotels', async (req, res) => {
    const rawCity = (req.query.city || 'Manali').trim();
    const cityKey = rawCity.toLowerCase();
    const cacheKey = `hotels_${cityKey}`;

    if (_travelCatalogCache.has(cacheKey)) {
        return res.json({ city: rawCity, source: 'cache', hotels: _travelCatalogCache.get(cacheKey) });
    }

    if (process.env.GEMINI_API_KEY) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const prompt = `You are a real-world hotel booking API for "${rawCity}". Return 4 to 5 REAL, ACTUAL, EXISTING hotels and resorts that travelers can book in "${rawCity}".
Return strictly valid JSON only without markdown or codeblocks:
{
  "hotels": [
    {
      "id": "htl-1",
      "name": "Actual Real Hotel Name",
      "city": "${rawCity}",
      "rating": 4.8,
      "reviewsCount": 450,
      "pricePerNight": 3499,
      "currency": "INR",
      "stars": 4,
      "tag": "Top Rated / Boutique Stay",
      "amenities": ["Free WiFi", "Breakfast Included", "Mountain/Sea View"],
      "address": "Real street or neighborhood in ${rawCity}",
      "photo_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
    }
  ]
}`;
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt
            });
            let cleanText = response.text.trim();
            if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
            }
            const parsed = JSON.parse(cleanText);
            if (parsed && Array.isArray(parsed.hotels) && parsed.hotels.length > 0) {
                _travelCatalogCache.set(cacheKey, parsed.hotels);
                return res.json({ city: rawCity, source: 'gemini-live', hotels: parsed.hotels });
            }
        } catch (e) {
            console.warn('Gemini hotels search fallback to curated catalog:', e.message);
        }
    }

    const matchedHotels = CURATED_HOTELS_DB[cityKey] || [
        {
            id: `htl-${cityKey}-1`,
            name: `${rawCity} Grand Heritage Resort`,
            city: rawCity,
            rating: 4.8,
            reviewsCount: 420,
            pricePerNight: 3899,
            currency: "INR",
            stars: 4,
            tag: "Center City & Scenic View",
            amenities: ["Free High-speed WiFi", "Complimentary Breakfast", "24/7 Room Service", "Scenic View Balcony"],
            address: `Main Boulevard, ${rawCity}`,
            photo_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
        },
        {
            id: `htl-${cityKey}-2`,
            name: `Zostel & Nomad Hostel ${rawCity}`,
            city: rawCity,
            rating: 4.7,
            reviewsCount: 780,
            pricePerNight: 999,
            currency: "INR",
            stars: 3,
            tag: "Backpacker Favorite",
            amenities: ["Co-working Desk & WiFi", "Rooftop Community Cafe", "Lockers & Hot Showers", "City Walking Tours"],
            address: `Old Town Traveler Lane, ${rawCity}`,
            photo_url: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80"
        }
    ];

    _travelCatalogCache.set(cacheKey, matchedHotels);
    res.json({ city: rawCity, source: 'curated-catalog', hotels: matchedHotels });
});

// API: Flights Search
app.get('/api/bookings/flights', async (req, res) => {
    const origin = (req.query.origin || 'DEL').toUpperCase();
    const destination = (req.query.destination || 'BOM').toUpperCase();
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const flights = [
        {
            id: 'flt-101',
            airline: 'IndiGo',
            flightNumber: '6E-2045',
            origin,
            destination,
            departureTime: '06:15 AM',
            arrivalTime: '08:30 AM',
            duration: '2h 15m',
            stops: 'Non-stop',
            price: 4299,
            currency: 'INR',
            badge: 'Fastest Flight'
        },
        {
            id: 'flt-102',
            airline: 'Air India',
            flightNumber: 'AI-805',
            origin,
            destination,
            departureTime: '09:00 AM',
            arrivalTime: '11:15 AM',
            duration: '2h 15m',
            stops: 'Non-stop',
            price: 4899,
            currency: 'INR',
            badge: 'Complimentary Meal'
        },
        {
            id: 'flt-103',
            airline: 'Vistara',
            flightNumber: 'UK-992',
            origin,
            destination,
            departureTime: '02:30 PM',
            arrivalTime: '04:45 PM',
            duration: '2h 15m',
            stops: 'Non-stop',
            price: 5299,
            currency: 'INR',
            badge: 'Premium Economy Available'
        }
    ];

    res.json({ origin, destination, date, flights });
});

// API: Cabs Search
app.get('/api/bookings/cabs', (req, res) => {
    const origin = req.query.origin || 'Airport / City Center';
    const destination = req.query.destination || 'Hotel / Destination';

    const cabs = [
        { id: 'cab-1', type: 'Sedan', model: 'Maruti Dzire / Etios', seats: 4, ac: true, price: 1199, currency: 'INR', eta: '4 mins away' },
        { id: 'cab-2', type: 'SUV / Ertiga', model: 'Maruti Ertiga / Triber', seats: 6, ac: true, price: 1699, currency: 'INR', eta: '7 mins away' },
        { id: 'cab-3', type: 'Luxury Innova Crysta', model: 'Toyota Innova Crysta', seats: 7, ac: true, price: 2399, currency: 'INR', eta: '10 mins away' }
    ];
    res.json({ origin, destination, cabs });
});

// API: Buses Search
app.get('/api/bookings/buses', (req, res) => {
    const origin = req.query.origin || 'Delhi';
    const destination = req.query.destination || 'Manali';

    const buses = [
        { id: 'bus-1', operator: 'Zingbus Electric Volvo', type: 'AC BharatBenz Sleeper (2+1)', departure: '08:30 PM', arrival: '07:30 AM', duration: '11h', rating: 4.8, price: 1099, currency: 'INR' },
        { id: 'bus-2', operator: 'IntrCity SmartBus', type: 'Multi-Axle Volvo AC Sleeper', departure: '09:15 PM', arrival: '08:15 AM', duration: '11h', rating: 4.7, price: 1299, currency: 'INR' }
    ];
    res.json({ origin, destination, buses });
});

// API: Create Booking & Record Payment Transaction (Firestore)
app.post('/api/bookings/create', async (req, res) => {
    const authHeader = req.headers['authorization'];
    let userId = null;
    if (authHeader && authHeader.split(' ')[1]) {
        try {
            const decoded = jwt.verify(authHeader.split(' ')[1], SECRET_KEY);
            userId = decoded.id;
        } catch(e) {}
    }

    const {
        type = 'hotel',
        title,
        subtitle = '',
        details = '',
        price = 0,
        currency = 'INR',
        destination = 'Travel Destination',
        origin = '',
        travel_date = new Date().toISOString().split('T')[0],
        payment_method = 'UPI',
        txn_id = `TXN-TN-${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random()*9000)}`,
        guest_name = 'Traveler',
        guest_phone = '+91 98765 43210',
        guest_email = 'traveler@triponext.com',
        seat_or_room = '1 Room / 2 Guests'
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Booking title is required' });

    const typePrefix = type === 'flight' ? 'FLT' : type === 'hotel' ? 'HTL' : type === 'cab' ? 'CAB' : 'BUS';
    const bookingRef = `TN-${typePrefix}-${Math.floor(100000 + Math.random()*900000)}`;

    try {
        const booking = await db.insert('bookings', {
            user_id: userId ? String(userId) : null,
            type,
            title,
            subtitle,
            details,
            price: Number(price),
            currency,
            status: 'Confirmed',
            travel_date,
            booking_ref: bookingRef,
            origin,
            destination,
            payment_method,
            txn_id,
            guest_name,
            guest_phone,
            guest_email,
            seat_or_room,
            booking_date: new Date().toISOString()
        });

        res.json({
            success: true,
            id: booking.id,
            booking_ref: bookingRef,
            txn_id,
            status: 'Confirmed',
            type,
            title,
            subtitle,
            price: Number(price),
            currency,
            destination,
            payment_method,
            guest_name,
            guest_email,
            guest_phone,
            seat_or_room,
            booking_date: booking.booking_date
        });
    } catch (err) {
        console.error('[Bookings API] Error inserting booking:', err);
        res.status(500).json({ error: 'Database error creating booking', details: err.message });
    }
});

// API: Get All My Bookings (Firestore)
app.get('/api/bookings/my-bookings', async (req, res) => {
    const authHeader = req.headers['authorization'];
    let userId = null;
    if (authHeader && authHeader.split(' ')[1]) {
        try {
            const decoded = jwt.verify(authHeader.split(' ')[1], SECRET_KEY);
            userId = decoded.id;
        } catch(e) {}
    }

    try {
        let bookings = [];
        if (userId) {
            bookings = await db.find('bookings', [{ field: 'user_id', op: '==', value: String(userId) }], { orderBy: 'booking_date', orderDir: 'desc', limit: 50 });
        } else {
            bookings = await db.find('bookings', [], { orderBy: 'booking_date', orderDir: 'desc', limit: 50 });
        }
        res.json(bookings);
    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).json({ error: 'Database error fetching bookings' });
    }
});

// API: Cancel Booking (Firestore)
app.delete('/api/bookings/:id', async (req, res) => {
    const bookingId = req.params.id;
    try {
        await db.update('bookings', bookingId, { status: 'Cancelled' });
        res.json({ success: true, message: 'Booking cancelled successfully. 100% refund initiated back to source.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
});

// Fallback to serve index.html for SPA-like behavior if needed
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!process.env.VERCEL) {
    const mainServer = app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
    mainServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[Server] Port ${PORT} already in use, app remains reachable.`);
        } else {
            console.error('[Server error]:', err);
        }
    });

    // Also listen on port 3000 if PORT is 3001
    if (Number(PORT) !== 3000) {
        try {
            const altServer = app.listen(3000, () => {
                console.log(`Also accessible on http://localhost:3000`);
            });
            altServer.on('error', () => { /* port 3000 in use, ignore gracefully */ });
        } catch(e) {}
    }
}

module.exports = app;
