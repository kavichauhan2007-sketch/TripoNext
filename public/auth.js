document.addEventListener('DOMContentLoaded', () => {
    // Redirect if already logged in
    if(localStorage.getItem('token')) {
        window.location.href = 'index.html';
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await res.json();
                if(res.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = 'index.html';
                } else {
                    alert(data.error);
                }
            } catch (err) {
                console.warn("API failed, falling back to local storage auth");
                // Fallback for file:// testing
                const localUsers = JSON.parse(localStorage.getItem('localUsers') || '[]');
                const user = localUsers.find(u => u.email === email && u.password === password);
                if(user) {
                    localStorage.setItem('token', 'local-token-' + Date.now());
                    localStorage.setItem('user', JSON.stringify({name: user.name, email: user.email}));
                    window.location.href = 'index.html';
                } else {
                    alert("Invalid email or password. (Local fallback)");
                }
            }
        });
    }

    if(registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            
            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                
                const data = await res.json();
                if(res.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = 'index.html';
                } else {
                    alert(data.error);
                }
            } catch (err) {
                console.warn("API failed, falling back to local storage auth");
                // Fallback for file:// testing
                const localUsers = JSON.parse(localStorage.getItem('localUsers') || '[]');
                if(localUsers.find(u => u.email === email)) {
                    alert("Email already exists (Local fallback)");
                } else {
                    localUsers.push({ name, email, password });
                    localStorage.setItem('localUsers', JSON.stringify(localUsers));
                    localStorage.setItem('token', 'local-token-' + Date.now());
                    localStorage.setItem('user', JSON.stringify({name, email}));
                    window.location.href = 'index.html';
                }
            }
        });
    }
});

function toggleAuth() {
    const loginBox = document.getElementById('login-box');
    const registerBox = document.getElementById('register-box');
    
    if(loginBox.style.display === 'none') {
        loginBox.style.display = 'block';
        registerBox.style.display = 'none';
    } else {
        loginBox.style.display = 'none';
        registerBox.style.display = 'block';
    }
}

