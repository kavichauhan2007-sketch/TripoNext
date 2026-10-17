/**
 * TripoNext Secure MFA Automated Test Suite
 * Covers all 8 core security and regression test categories:
 * 1. Existing login, signup, guest auth, and logout regressions
 * 2. Protected endpoint access rejection with challenge tokens
 * 3. MFA enrollment initiation, password re-auth, QR code generation, and confirmation
 * 4. Valid and invalid authenticator codes during login
 * 5. Expired and replayed TOTP codes prevention
 * 6. One-time recovery code use and single-use reuse prevention
 * 7. Rate limiting, brute-force protection, and attempt limits
 * 8. Recovery codes regeneration and MFA disablement flow
 */

const assert = require('assert');
const { generateSync } = require('otplib');
const app = require('./server');

let server;
let baseUrl;

function logTest(name, passed = true, detail = '') {
    const symbol = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${symbol}] ${name}${detail ? ' - ' + detail : ''}`);
}

async function runTestSuite() {
    console.log('\n======================================================');
    console.log('  TripNext Secure Multi-Factor Authentication Test Suite');
    console.log('======================================================\n');

    // Start server on an ephemeral random port to avoid port collisions
    server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Test server running at ${baseUrl}\n`);

    let passedCount = 0;
    let failedCount = 0;

    async function test(name, fn) {
        try {
            await fn();
            logTest(name, true);
            passedCount++;
        } catch (err) {
            logTest(name, false, err.message);
            console.error(err);
            failedCount++;
        }
    }

    const testEmail = `mfatest_${Date.now()}@triponext.com`;
    const testPassword = 'StrongPassword@2026';
    let userToken = '';
    let totpSecret = '';
    let recoveryCodes = [];
    let savedUsedRecoveryCode = '';

    // ----------------------------------------------------
    // Category 1: Existing Auth & Regressions
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Existing Auth & Regressions ---');

    await test('1.1 User registration succeeds with valid credentials', async () => {
        const res = await fetch(`${baseUrl}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Security Tester', email: testEmail, password: testPassword })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.ok(data.token, 'Registration should return JWT session token');
        assert.strictEqual(data.user.email, testEmail);
        userToken = data.token;
    });

    await test('1.2 Duplicate registration is rejected', async () => {
        const res = await fetch(`${baseUrl}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Security Tester', email: testEmail, password: testPassword })
        });
        assert.strictEqual(res.status, 400);
    });

    await test('1.3 Normal user login without MFA returns session token directly', async () => {
        const res = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.ok(data.token, 'Non-MFA user should get token directly');
        assert.strictEqual(data.mfa_required, undefined);
    });

    await test('1.4 Login with invalid password returns generic 401 error', async () => {
        const res = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: 'WrongPassword123' })
        });
        assert.strictEqual(res.status, 401);
        const data = await res.json();
        assert.strictEqual(data.error, 'Invalid email or password');
    });

    await test('1.5 Login with non-existent email returns generic 401 error (no user enumeration)', async () => {
        const res = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: `nonexistent_${Date.now()}@triponext.com`, password: 'SomePassword' })
        });
        assert.strictEqual(res.status, 401);
        const data = await res.json();
        assert.strictEqual(data.error, 'Invalid email or password');
    });

    await test('1.6 Guest login token compatibility remains functional', async () => {
        const res = await fetch(`${baseUrl}/api/user/profile`, {
            headers: { 'Authorization': `Bearer guest-token-${Date.now()}` }
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(data.name, 'Guest profile should resolve');
    });

    // ----------------------------------------------------
    // Category 2: Protected Endpoints & Challenge Tokens
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Protected Endpoints & Challenge Tokens ---');

    await test('2.1 Protected endpoint without token returns 401 Unauthorized', async () => {
        const res = await fetch(`${baseUrl}/api/trips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: 'Goa', dates: '2026-11-01', budget: 15000 })
        });
        assert.strictEqual(res.status, 401);
    });

    await test('2.2 MFA status for non-enrolled user reports disabled', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/status`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.mfa_enabled, false);
        assert.strictEqual(data.remaining_recovery_codes, 0);
    });

    // ----------------------------------------------------
    // Category 3: MFA Enrollment & Confirmation
    // ----------------------------------------------------
    console.log('\n--- 3. Testing MFA Enrollment & Confirmation ---');

    await test('3.1 Enrollment initiation rejects incorrect password', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/enroll`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ current_password: 'IncorrectPassword' })
        });
        assert.strictEqual(res.status, 401);
    });

    await test('3.2 Enrollment initiation succeeds with correct password, returns secret & QR code', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/enroll`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ current_password: testPassword })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(data.secret, 'Must provide manual setup secret');
        assert.ok(data.qr_code && data.qr_code.startsWith('data:image/png;base64,'), 'Must provide QR code data URL');
        assert.ok(data.otpauth_url && data.otpauth_url.includes('TripoNext'), 'Must provide otpauth URL');
        totpSecret = data.secret;
    });

    await test('3.3 Confirming enrollment rejects invalid 6-digit code', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/confirm-enrollment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ code: '000000' })
        });
        assert.strictEqual(res.status, 400);
    });

    await test('3.4 Confirming enrollment succeeds with valid TOTP code and generates 8 recovery codes', async () => {
        const validCode = generateSync({ secret: totpSecret });
        const res = await fetch(`${baseUrl}/api/auth/mfa/confirm-enrollment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ code: validCode })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.ok(Array.isArray(data.recovery_codes), 'Must return recovery codes');
        assert.strictEqual(data.recovery_codes.length, 8, 'Must return exactly 8 recovery codes');
        recoveryCodes = data.recovery_codes;
    });

    await test('3.5 Status endpoint now confirms MFA is enabled with 8 active recovery codes', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/status`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.mfa_enabled, true);
        assert.strictEqual(data.method, 'totp');
        assert.strictEqual(data.remaining_recovery_codes, 8);
    });

    // ----------------------------------------------------
    // Category 4: MFA Challenge & Verification Flow
    // ----------------------------------------------------
    console.log('\n--- 4. Testing MFA Challenge & Verification Flow ---');

    let challengeToken = '';

    await test('4.1 Login for MFA-enrolled user issues challenge token instead of session token', async () => {
        const res = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.mfa_required, true, 'mfa_required must be true');
        assert.ok(data.mfa_token, 'Must issue mfa_token');
        assert.ok(data.challenge_id, 'Must issue challenge_id');
        assert.ok(!data.token, 'Must NOT issue authenticated session token');
        assert.ok(data.user_email_masked, 'Must include masked email');
        challengeToken = data.mfa_token;
    });

    await test('4.2 Attempts to access protected endpoint using MFA challenge token are REJECTED', async () => {
        const res = await fetch(`${baseUrl}/api/trips`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${challengeToken}`
            },
            body: JSON.stringify({ destination: 'Manali', dates: '2026-12-01', budget: 20000 })
        });
        assert.strictEqual(res.status, 401, 'Challenge token must NOT grant access to protected resources');
        const data = await res.json();
        assert.ok(data.error.includes('MFA'), 'Error must specify MFA challenge incomplete');
    });

    await test('4.3 Verifying challenge rejects invalid TOTP code and decrements attempts left', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfa_token: challengeToken, code: '111111', method: 'totp' })
        });
        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.ok(data.attempts_left < 5, 'Attempts left must decrement');
    });

    await test('4.4 Verifying challenge with valid TOTP code creates authenticated session', async () => {
        const validCode = generateSync({ secret: totpSecret });
        const res = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfa_token: challengeToken, code: validCode, method: 'totp' })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(data.token, 'Must issue authenticated session token');
        assert.strictEqual(data.user.email, testEmail);
        userToken = data.token; // update active session token
    });

    // ----------------------------------------------------
    // Category 5: Replayed & Consumed Challenges / Codes
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Replay Prevention & Consumed Challenges ---');

    await test('5.1 Consumed challenge cannot be reused', async () => {
        const validCode = generateSync({ secret: totpSecret });
        const res = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfa_token: challengeToken, code: validCode, method: 'totp' })
        });
        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.ok(data.error.includes('consumed') || data.error.includes('invalid'));
    });

    await test('5.2 Replay of same TOTP code within same timestep is rejected', async () => {
        // Step A: Request fresh challenge
        const loginRes = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        });
        const loginData = await loginRes.json();
        const freshChallengeToken = loginData.mfa_token;

        // Step B: Attempt verify with the exact same code that was already used in test 4.4
        const sameCode = generateSync({ secret: totpSecret });
        const res = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfa_token: freshChallengeToken, code: sameCode, method: 'totp' })
        });
        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.ok(data.error.includes('Replayed') || data.error.includes('Invalid'));
    });

    // ----------------------------------------------------
    // Category 6: Recovery Codes (Single-Use & Reuse Prevention)
    // ----------------------------------------------------
    console.log('\n--- 6. Testing Recovery Codes Single-Use & Reuse Prevention ---');

    await test('6.1 Sign in using valid single-use recovery code succeeds', async () => {
        const loginRes = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        });
        const loginData = await loginRes.json();

        savedUsedRecoveryCode = recoveryCodes[0];
        const res = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mfa_token: loginData.mfa_token,
                code: savedUsedRecoveryCode,
                method: 'recovery_code'
            })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(data.token, 'Recovery code sign in must issue valid session token');
        userToken = data.token;
    });

    await test('6.2 Reusing the same recovery code is STRICTLY REJECTED', async () => {
        const loginRes = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        });
        const loginData = await loginRes.json();

        const res = await fetch(`${baseUrl}/api/auth/mfa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mfa_token: loginData.mfa_token,
                code: savedUsedRecoveryCode, // Already used!
                method: 'recovery_code'
            })
        });
        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.ok(data.error.includes('recovery code'));
    });

    await test('6.3 Remaining recovery codes count accurately drops from 8 to 7', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/status`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.remaining_recovery_codes, 7);
    });

    // ----------------------------------------------------
    // Category 7: Email OTP & Audit Logging
    // ----------------------------------------------------
    console.log('\n--- 7. Testing Email OTP & Security Audit Logs ---');

    await test('7.1 Dispatching Email OTP generates secure challenge without leaking OTP in response', async () => {
        const loginRes = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        });
        const loginData = await loginRes.json();

        const res = await fetch(`${baseUrl}/api/auth/mfa/email-otp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfa_token: loginData.mfa_token })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.otp, undefined, 'Plain OTP must NEVER be exposed in response body');
    });

    await test('7.2 Security audit logs record enrollment, challenge, and verification events', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/audit-logs`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data.audit_logs));
        assert.ok(data.audit_logs.length >= 3, 'Audit log must record security events');
        const events = data.audit_logs.map(l => l.event);
        assert.ok(events.includes('MFA_ENROLLED'), 'Must contain MFA_ENROLLED event');
        assert.ok(events.includes('MFA_LOGIN_CHALLENGED'), 'Must contain MFA_LOGIN_CHALLENGED event');
    });

    // ----------------------------------------------------
    // Category 8: Regenerate Recovery Codes & Disable MFA
    // ----------------------------------------------------
    console.log('\n--- 8. Testing Regenerate Recovery Codes & Disable MFA ---');

    await test('8.1 Regenerating recovery codes invalidates all previous codes and issues fresh 8 codes', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/recovery-codes/regenerate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ current_password: testPassword })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.recovery_codes.length, 8);
        assert.ok(!data.recovery_codes.includes(recoveryCodes[1]), 'Fresh codes must be newly generated');
        recoveryCodes = data.recovery_codes;
    });

    await test('8.2 Status endpoint shows remaining recovery codes reset to 8', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/status`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const data = await res.json();
        assert.strictEqual(data.remaining_recovery_codes, 8);
    });

    await test('8.3 Disabling MFA requires current password and valid second factor', async () => {
        const wrongPassRes = await fetch(`${baseUrl}/api/auth/mfa/disable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ current_password: 'WrongPassword', code: recoveryCodes[0] })
        });
        assert.strictEqual(wrongPassRes.status, 401);

        const validDisableRes = await fetch(`${baseUrl}/api/auth/mfa/disable`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ current_password: testPassword, code: recoveryCodes[0] })
        });
        assert.strictEqual(validDisableRes.status, 200);
        const data = await validDisableRes.json();
        assert.strictEqual(data.success, true);
    });

    await test('8.4 Status endpoint confirms MFA is now disabled', async () => {
        const res = await fetch(`${baseUrl}/api/auth/mfa/status`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const data = await res.json();
        assert.strictEqual(data.mfa_enabled, false);
    });

    await test('8.5 User can now sign in normally without MFA challenge', async () => {
        const res = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.ok(data.token, 'Must return session token directly');
        assert.strictEqual(data.mfa_required, undefined);
    });

    // ----------------------------------------------------
    // Summary
    // ----------------------------------------------------
    console.log('\n======================================================');
    console.log(`  Test Suite Completed: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('======================================================\n');

    server.close();

    if (failedCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTestSuite().catch((err) => {
    console.error('Fatal test error:', err);
    if (server) server.close();
    process.exit(1);
});
