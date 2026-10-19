// TripoNext Authentication & Secure MFA Controller

let _currentMfaChallenge = null;
let _mfaTimerInterval = null;
let _mfaMethod = 'totp'; // 'totp' | 'recovery_code' | 'email_otp'

document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in and not explicitly logged out
    if (localStorage.getItem('token') && sessionStorage.getItem('triponext_explicit_logout') !== 'true') {
        window.location.href = 'index.html';
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const mfaForm = document.getElementById('mfa-form');

    // 1. Primary Login Handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) return;

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;

                if (res.ok) {
                    // Check if second factor is required
                    if (data.mfa_required) {
                        startMfaVerification(data);
                        return;
                    }

                    // Direct login if MFA is not enabled
                    sessionStorage.removeItem('triponext_explicit_logout');
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.removeItem('user_profile_cache');
                    window.location.href = 'index.html';
                } else {
                    showAuthAlert(data.error || 'Invalid email or password.');
                }
            } catch (err) {
                console.warn("API failed, falling back to local storage auth", err);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;

                // Fallback for file:// and offline testing
                const localUsers = JSON.parse(localStorage.getItem('localUsers') || '[]');
                const user = localUsers.find(u => u.email === email && u.password === password);
                if (user) {
                    sessionStorage.removeItem('triponext_explicit_logout');
                    localStorage.setItem('token', 'local-token-' + Date.now());
                    localStorage.setItem('user', JSON.stringify({ name: user.name, email: user.email, phone: user.phone || '' }));
                    localStorage.removeItem('user_profile_cache');
                    window.location.href = 'index.html';
                } else {
                    showAuthAlert("Invalid email or password.");
                }
            }
        });
    }

    // 2. Registration Handler
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const phone = document.getElementById('reg-phone') ? document.getElementById('reg-phone').value.trim() : '';
            const password = document.getElementById('reg-password').value;
            const submitBtn = registerForm.querySelector('button[type="submit"]');

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';

            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, phone })
                });

                const data = await res.json();
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;

                if (res.ok) {
                    sessionStorage.removeItem('triponext_explicit_logout');
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.removeItem('user_profile_cache');
                    window.location.href = 'index.html';
                } else {
                    showAuthAlert(data.error || 'Registration failed.');
                }
            } catch (err) {
                console.warn("API failed, falling back to local storage registration");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;

                const localUsers = JSON.parse(localStorage.getItem('localUsers') || '[]');
                if (localUsers.find(u => u.email === email)) {
                    showAuthAlert("Email already exists");
                } else {
                    localUsers.push({ name, email, password, phone });
                    localStorage.setItem('localUsers', JSON.stringify(localUsers));
                    sessionStorage.removeItem('triponext_explicit_logout');
                    localStorage.setItem('token', 'local-token-' + Date.now());
                    localStorage.setItem('user', JSON.stringify({ name, email, phone }));
                    localStorage.removeItem('user_profile_cache');
                    window.location.href = 'index.html';
                }
            }
        });
    }

    // 3. MFA Verification Form Submission
    if (mfaForm) {
        mfaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!_currentMfaChallenge) {
                showMfaStatus('Verification session expired. Please log in again.', 'error');
                return;
            }

            let code = '';
            if (_mfaMethod === 'recovery_code') {
                code = document.getElementById('mfa-recovery-code').value.trim();
            } else {
                code = document.getElementById('mfa-code').value.trim();
            }

            if (!code) {
                showMfaStatus('Please enter your verification code.', 'error');
                return;
            }

            const verifyBtn = document.getElementById('mfa-verify-btn');
            const verifyText = document.getElementById('mfa-verify-btn-text');
            const originalHtml = verifyText.innerHTML;

            verifyBtn.disabled = true;
            verifyText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

            try {
                const res = await fetch('/api/auth/mfa/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mfa_token: _currentMfaChallenge.mfa_token,
                        code: code,
                        method: _mfaMethod
                    })
                });

                const data = await res.json();
                verifyBtn.disabled = false;
                verifyText.innerHTML = originalHtml;

                if (res.ok) {
                    clearInterval(_mfaTimerInterval);
                    showMfaStatus('Verification successful! Redirecting...', 'success');

                    // Store authenticated session
                    sessionStorage.removeItem('triponext_explicit_logout');
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.removeItem('user_profile_cache');

                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 500);
                } else {
                    showMfaStatus(data.error || 'Verification failed. Please check the code and try again.', 'error');
                    if (data.attempts_left !== undefined) {
                        const countEl = document.getElementById('mfa-attempts-count');
                        if (countEl) countEl.textContent = data.attempts_left;
                        if (data.attempts_left <= 0) {
                            verifyBtn.disabled = true;
                            showMfaStatus('Maximum attempts exceeded. Please cancel and log in again.', 'error');
                        }
                    }
                }
            } catch (err) {
                verifyBtn.disabled = false;
                verifyText.innerHTML = originalHtml;
                showMfaStatus('Network error while verifying code. Please try again.', 'error');
            }
        });
    }

    // Auto-advance digits or format input
    const mfaCodeInput = document.getElementById('mfa-code');
    if (mfaCodeInput) {
        mfaCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
            if (e.target.value.length === 6) {
                // Auto submit when 6 digits are reached
                const mfaFormEl = document.getElementById('mfa-form');
                if (mfaFormEl && _mfaMethod !== 'recovery_code') {
                    mfaFormEl.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            }
        });
    }

    const mfaRecoveryInput = document.getElementById('mfa-recovery-code');
    if (mfaRecoveryInput) {
        mfaRecoveryInput.addEventListener('input', (e) => {
            let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (val.length > 4) {
                val = val.slice(0, 4) + '-' + val.slice(4, 8);
            }
            e.target.value = val.slice(0, 9);
        });
    }
});

/**
 * Initiates the MFA verification screen when backend responds with mfa_required = true
 */
function startMfaVerification(challengeData) {
    _currentMfaChallenge = challengeData;
    _mfaMethod = 'totp';

    const loginBox = document.getElementById('login-box');
    const registerBox = document.getElementById('register-box');
    const mfaBox = document.getElementById('mfa-box');

    if (loginBox) loginBox.style.display = 'none';
    if (registerBox) registerBox.style.display = 'none';
    if (mfaBox) mfaBox.style.display = 'block';

    const subtitleEl = document.getElementById('mfa-subtitle');
    if (subtitleEl && challengeData.user_email_masked) {
        subtitleEl.textContent = `Security verification for ${challengeData.user_email_masked}. Enter your 6-digit authenticator code.`;
    }

    // Reset fields & method
    resetMfaInputs();

    // Start 5-minute challenge countdown timer
    startMfaTimer(300);

    // Focus input
    setTimeout(() => {
        const input = document.getElementById('mfa-code');
        if (input) input.focus();
    }, 150);
}

/**
 * Starts countdown timer for MFA challenge
 */
function startMfaTimer(secondsTotal) {
    clearInterval(_mfaTimerInterval);
    let secondsLeft = secondsTotal;

    const updateTimerDisplay = () => {
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        const timerEl = document.getElementById('mfa-timer');
        if (timerEl) {
            timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            if (secondsLeft <= 60) {
                timerEl.style.color = '#f87171'; // red warning
            } else {
                timerEl.style.color = '#facc15'; // yellow standard
            }
        }

        if (secondsLeft <= 0) {
            clearInterval(_mfaTimerInterval);
            showMfaStatus('Verification challenge has expired. Please cancel and log in again.', 'error');
            const verifyBtn = document.getElementById('mfa-verify-btn');
            if (verifyBtn) verifyBtn.disabled = true;
        }
        secondsLeft--;
    };

    updateTimerDisplay();
    _mfaTimerInterval = setInterval(updateTimerDisplay, 1000);
}

/**
 * Toggle between TOTP app code and backup recovery code
 */
function toggleMfaRecoveryMethod() {
    const codeWrapper = document.getElementById('mfa-code-input-wrapper');
    const recoveryWrapper = document.getElementById('mfa-recovery-input-wrapper');
    const toggleText = document.getElementById('mfa-toggle-text');
    const codeLabel = document.getElementById('mfa-code-label');

    if (_mfaMethod === 'recovery_code') {
        _mfaMethod = 'totp';
        codeWrapper.style.display = 'block';
        recoveryWrapper.style.display = 'none';
        toggleText.textContent = 'Use a backup recovery code';
        if (codeLabel) codeLabel.innerHTML = '<i class="fa-solid fa-key" style="margin-right: 5px; color: var(--primary);"></i> Authenticator 6-Digit Code';
        const codeInput = document.getElementById('mfa-code');
        if (codeInput) codeInput.focus();
    } else {
        _mfaMethod = 'recovery_code';
        codeWrapper.style.display = 'none';
        recoveryWrapper.style.display = 'block';
        toggleText.textContent = 'Use authenticator app instead';
        const recoveryInput = document.getElementById('mfa-recovery-code');
        if (recoveryInput) recoveryInput.focus();
    }
}

/**
 * Request an Email OTP code for verification
 */
async function requestMfaEmailOtp() {
    if (!_currentMfaChallenge || !_currentMfaChallenge.mfa_token) {
        showMfaStatus('Verification session missing. Please log in again.', 'error');
        return;
    }

    const emailBtn = document.getElementById('mfa-send-email-btn');
    const originalText = emailBtn.innerHTML;
    emailBtn.disabled = true;
    emailBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending code...';

    try {
        const res = await fetch('/api/auth/mfa/email-otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfa_token: _currentMfaChallenge.mfa_token })
        });
        const data = await res.json();
        emailBtn.disabled = false;
        emailBtn.innerHTML = originalText;

        if (res.ok) {
            _mfaMethod = 'email_otp';
            const codeWrapper = document.getElementById('mfa-code-input-wrapper');
            const recoveryWrapper = document.getElementById('mfa-recovery-input-wrapper');
            const codeLabel = document.getElementById('mfa-code-label');

            codeWrapper.style.display = 'block';
            recoveryWrapper.style.display = 'none';
            if (codeLabel) codeLabel.innerHTML = '<i class="fa-regular fa-envelope" style="margin-right: 5px; color: #38bdf8;"></i> Email OTP 6-Digit Code';

            showMfaStatus(data.message || 'Verification code sent to your email!', 'success');
            const codeInput = document.getElementById('mfa-code');
            if (codeInput) {
                codeInput.value = '';
                codeInput.focus();
            }
        } else {
            showMfaStatus(data.error || 'Failed to dispatch email verification code.', 'error');
        }
    } catch (e) {
        emailBtn.disabled = false;
        emailBtn.innerHTML = originalText;
        showMfaStatus('Network error while requesting email code.', 'error');
    }
}

/**
 * Cancel MFA flow and return to regular login
 */
function cancelMfaVerification() {
    clearInterval(_mfaTimerInterval);
    _currentMfaChallenge = null;
    _mfaMethod = 'totp';

    const loginBox = document.getElementById('login-box');
    const registerBox = document.getElementById('register-box');
    const mfaBox = document.getElementById('mfa-box');

    if (mfaBox) mfaBox.style.display = 'none';
    if (loginBox) loginBox.style.display = 'block';
    if (registerBox) registerBox.style.display = 'none';

    // Clear password input for security
    const pass = document.getElementById('login-password');
    if (pass) pass.value = '';
}

/**
 * Reset inputs and status banner
 */
function resetMfaInputs() {
    const codeInput = document.getElementById('mfa-code');
    const recoveryInput = document.getElementById('mfa-recovery-code');
    const codeWrapper = document.getElementById('mfa-code-input-wrapper');
    const recoveryWrapper = document.getElementById('mfa-recovery-input-wrapper');
    const banner = document.getElementById('mfa-status-banner');
    const toggleText = document.getElementById('mfa-toggle-text');
    const codeLabel = document.getElementById('mfa-code-label');
    const attemptsCount = document.getElementById('mfa-attempts-count');
    const verifyBtn = document.getElementById('mfa-verify-btn');

    if (codeInput) codeInput.value = '';
    if (recoveryInput) recoveryInput.value = '';
    if (codeWrapper) codeWrapper.style.display = 'block';
    if (recoveryWrapper) recoveryWrapper.style.display = 'none';
    if (banner) { banner.style.display = 'none'; banner.textContent = ''; }
    if (toggleText) toggleText.textContent = 'Use a backup recovery code';
    if (codeLabel) codeLabel.innerHTML = '<i class="fa-solid fa-key" style="margin-right: 5px; color: var(--primary);"></i> Authenticator 6-Digit Code';
    if (attemptsCount) attemptsCount.textContent = '5';
    if (verifyBtn) verifyBtn.disabled = false;
}

/**
 * Display alert/banner in MFA box
 */
function showMfaStatus(message, type = 'error') {
    const banner = document.getElementById('mfa-status-banner');
    if (!banner) return;

    banner.textContent = message;
    banner.style.display = 'block';

    if (type === 'success') {
        banner.style.background = 'rgba(16, 185, 129, 0.2)';
        banner.style.border = '1px solid rgba(16, 185, 129, 0.4)';
        banner.style.color = '#34d399';
    } else {
        banner.style.background = 'rgba(239, 68, 68, 0.2)';
        banner.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        banner.style.color = '#f87171';
    }
}

/**
 * Universal alert fallback
 */
function showAuthAlert(msg) {
    alert(msg);
}

function toggleAuth() {
    const loginBox = document.getElementById('login-box');
    const registerBox = document.getElementById('register-box');
    const mfaBox = document.getElementById('mfa-box');

    if (mfaBox) mfaBox.style.display = 'none';

    if (loginBox.style.display === 'none') {
        loginBox.style.display = 'block';
        registerBox.style.display = 'none';
    } else {
        loginBox.style.display = 'none';
        registerBox.style.display = 'block';
    }
}

window.loginAsGuest = function() {
    const guestUser = {
        name: "Rahul Sharma",
        email: "rahul.traveler@triponext.com",
        phone: "+91 98765 43210",
        bio: "Passionate road-tripper, mountain lover & culture explorer.",
        avatar: "avatar-1",
        home_city: "Delhi, India",
        travel_style: "Adventure & Cultural",
        referral_code: "TRIP-7492",
        referral_credits: 500
    };
    sessionStorage.removeItem('triponext_explicit_logout');
    localStorage.setItem('token', 'guest-token-' + Date.now());
    localStorage.setItem('user', JSON.stringify(guestUser));
    window.location.href = 'index.html';
};

// Interactive preview of the MFA screen
window.previewMfaScreen = function() {
    startMfaVerification({
        mfa_required: true,
        mfa_token: 'preview-demo-challenge-token',
        user_email_masked: 'demo***@triponext.com',
        expires_in: 300
    });
    showMfaStatus('Interactive 2FA Preview Mode. Test the 6-digit code or switch to recovery code.', 'info');
};

// Auto-fill demo account with 2FA enabled
window.fillDemo2faLogin = function() {
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');
    if (emailEl && passEl) {
        emailEl.value = 'demo2fa@triponext.com';
        passEl.value = 'Password123!';
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    }
};

// Global export for window scope
window.toggleMfaRecoveryMethod = toggleMfaRecoveryMethod;
window.requestMfaEmailOtp = requestMfaEmailOtp;
window.cancelMfaVerification = cancelMfaVerification;
window.toggleAuth = toggleAuth;

