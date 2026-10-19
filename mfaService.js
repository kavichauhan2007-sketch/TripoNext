const crypto = require('crypto');
const { generateSecret, generateURI, verifySync } = require('otplib');
const qrcode = require('qrcode');

// Master Encryption Key derivation
function getEncryptionKey() {
    const rawKey = process.env.MFA_ENCRYPTION_KEY || process.env.SECRET_KEY || 'super_secret_travel_buddy_key';
    return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypt sensitive secret at rest using AES-256-GCM.
 * Formatted as: iv:authTag:ciphertext (hex strings)
 */
function encryptSecret(plaintext) {
    if (!plaintext) return null;
    const iv = crypto.randomBytes(12);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt AES-256-GCM encrypted secret.
 */
function decryptSecret(payload) {
    if (!payload || typeof payload !== 'string' || !payload.includes(':')) return null;
    try {
        const [ivHex, tagHex, encryptedHex] = payload.split(':');
        if (!ivHex || !tagHex || !encryptedHex) return null;
        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (err) {
        console.error('MFA Secret decryption error:', err.message);
        return null;
    }
}

/**
 * Generate a new base32 TOTP secret.
 */
function generateTotpSecret() {
    return generateSecret({ length: 20 });
}

/**
 * Generate otpauth URI for QR code.
 */
function getOtpAuthUri(email, secret, issuer = 'TripoNext') {
    return generateURI({
        secret,
        label: email,
        issuer
    });
}

/**
 * Generate QR code as DataURL (Base64 PNG).
 */
async function generateQrCodeDataUrl(otpAuthUri) {
    return await qrcode.toDataURL(otpAuthUri, {
        margin: 2,
        width: 250,
        color: {
            dark: '#0f172a',
            light: '#ffffff'
        }
    });
}

/**
 * Verify a TOTP code with drift window and replay prevention.
 * @param {string} token 6-digit user input
 * @param {string} secret Decrypted base32 secret
 * @param {number} lastVerifiedStep Last verified TOTP timestep
 * @returns {{ valid: boolean, timeStep?: number, reason?: string }}
 */
function verifyTotpCode(token, secret, lastVerifiedStep = 0) {
    if (!token || !secret) return { valid: false, reason: 'Missing token or secret' };
    const cleanToken = String(token).replace(/\s+/g, '').trim();
    if (!/^\d{6}$/.test(cleanToken)) {
        return { valid: false, reason: 'Invalid format. Must be 6 digits.' };
    }

    try {
        // otplib v13 verifySync with 30s epochTolerance
        const result = verifySync({
            token: cleanToken,
            secret,
            epochTolerance: 30 // +/- 30 seconds clock drift allowance
        });

        if (!result || !result.valid) {
            return { valid: false, reason: 'Invalid or expired code.' };
        }

        // Replay prevention: verify timestep is newer than last recorded verified step
        if (lastVerifiedStep && result.timeStep && Number(result.timeStep) <= Number(lastVerifiedStep)) {
            return { valid: false, reason: 'Replayed code detected. Please wait for the next code.' };
        }

        return { valid: true, timeStep: result.timeStep };
    } catch (err) {
        return { valid: false, reason: 'Verification error: ' + err.message };
    }
}

/**
 * Generate a set of cryptographically secure one-time recovery codes.
 * Returns { plainCodes: string[], hashedCodes: { code_hash: string, salt: string }[] }
 */
function generateRecoveryCodes(count = 8) {
    const plainCodes = [];
    const hashedCodes = [];

    for (let i = 0; i < count; i++) {
        // e.g. "8C4F-29AE"
        const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const code = `${part1}-${part2}`;
        plainCodes.push(code);

        const salt = crypto.randomBytes(16).toString('hex');
        const normalized = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const codeHash = crypto.createHash('sha256').update(`${normalized}:${salt}`).digest('hex');

        hashedCodes.push({ code_hash: codeHash, salt });
    }

    return { plainCodes, hashedCodes };
}

/**
 * Verify a recovery code against stored hashes.
 * @param {Array<{ id: number, code_hash: string, salt: string, used: number }>} storedCodes
 * @param {string} inputCode
 * @returns {number|null} ID of the matched unused code, or null if invalid
 */
function verifyRecoveryCode(storedCodes, inputCode) {
    if (!inputCode || !Array.isArray(storedCodes)) return null;
    const normalizedInput = String(inputCode).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!normalizedInput || normalizedInput.length < 6) return null;

    for (const record of storedCodes) {
        if (record.used) continue;
        const hash = crypto.createHash('sha256').update(`${normalizedInput}:${record.salt}`).digest('hex');
        if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(record.code_hash))) {
            return record.id;
        }
    }
    return null;
}

/**
 * Audit Logging helper for all MFA operations.
 */
function logAuditEvent(db, { userId, event, status, req, details }) {
    if (!db) return;
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown') : 'system';
        const userAgent = req ? (req.headers['user-agent'] || 'unknown') : 'system';
        const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details || '');

        if (typeof db.insert === 'function') {
            db.insert('mfa_audit_logs', {
                user_id: String(userId || ''),
                event,
                status,
                ip_address: String(ip).slice(0, 100),
                user_agent: String(userAgent).slice(0, 255),
                details: detailsStr,
                created_at: new Date().toISOString()
            }).catch(err => console.error('Failed to write MFA audit log:', err.message));
        } else if (typeof db.run === 'function') {
            db.run(
                `INSERT INTO mfa_audit_logs (user_id, event, status, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?, ?)`,
                [userId || null, event, status, String(ip).slice(0, 100), String(userAgent).slice(0, 255), detailsStr],
                (err) => {
                    if (err) console.error('Failed to write MFA audit log:', err.message);
                }
            );
        }
    } catch (e) {
        console.error('Audit log error:', e.message);
    }
}

/**
 * Mask email address for safe challenge response (e.g. k***n@gmail.com).
 */
function maskEmail(email) {
    if (!email || !email.includes('@')) return 'user@example.com';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
        return `${local[0]}*@${domain}`;
    }
    return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}

// In-Memory Rate Limiter for Brute-Force Protection on MFA attempts
const mfaAttemptsCache = new Map(); // key: ip + userId -> { attempts: number, lockUntil: number }

function checkRateLimit(key, maxAttempts = 5, lockDurationMs = 15 * 60 * 1000) {
    const now = Date.now();
    const record = mfaAttemptsCache.get(key);

    if (record) {
        if (record.lockUntil && now < record.lockUntil) {
            const minutesLeft = Math.ceil((record.lockUntil - now) / 60000);
            return {
                allowed: false,
                lockUntil: record.lockUntil,
                message: `Too many failed attempts. Account locked for ${minutesLeft} minute(s).`
            };
        }
        if (record.lockUntil && now >= record.lockUntil) {
            mfaAttemptsCache.delete(key);
        }
    }
    return { allowed: true };
}

function recordFailedAttempt(key, maxAttempts = 5, lockDurationMs = 15 * 60 * 1000) {
    const now = Date.now();
    const record = mfaAttemptsCache.get(key) || { attempts: 0, lockUntil: 0 };
    record.attempts += 1;

    if (record.attempts >= maxAttempts) {
        record.lockUntil = now + lockDurationMs;
        mfaAttemptsCache.set(key, record);
        return {
            locked: true,
            attempts: record.attempts,
            lockDurationMinutes: Math.ceil(lockDurationMs / 60000)
        };
    }

    mfaAttemptsCache.set(key, record);
    return {
        locked: false,
        attemptsLeft: Math.max(0, maxAttempts - record.attempts)
    };
}

function resetRateLimit(key) {
    mfaAttemptsCache.delete(key);
}

module.exports = {
    encryptSecret,
    decryptSecret,
    generateTotpSecret,
    getOtpAuthUri,
    generateQrCodeDataUrl,
    verifyTotpCode,
    generateRecoveryCodes,
    verifyRecoveryCode,
    logAuditEvent,
    maskEmail,
    checkRateLimit,
    recordFailedAttempt,
    resetRateLimit
};
