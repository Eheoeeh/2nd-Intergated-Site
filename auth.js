/**
  Aura Authentication Logic
  Handles client-side validation, mock users database, Google Sign-In, 
  and session synchronization via localStorage.
**/

document.addEventListener('DOMContentLoaded', () => {
  const toast = document.getElementById('auth-toast');
  const toastMsg = document.getElementById('toast-message');

  // Helper: Show glassmorphic toast notification
  function showToast(message, type = 'success') {
    if (!toast) return;
    toastMsg.innerText = message;
    
    // Set dot color based on type
    const dot = toast.querySelector('.toast-dot');
    if (dot) {
      dot.style.backgroundColor = type === 'error' ? 'oklch(62% 0.18 25)' : 'oklch(76% 0.14 45)';
    }

    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Get users from localStorage, or initialize with mock admin user
  function getUsers() {
    const users = localStorage.getItem('aura_users');
    if (!users) {
      const defaultUsers = [
        { name: 'Aura Administrator', username: 'admin', email: 'admin@aura.io', password: 'password123' }
      ];
      localStorage.setItem('aura_users', JSON.stringify(defaultUsers));
      return defaultUsers;
    }
    return JSON.parse(users);
  }

  function saveUser(name, username, email, password) {
    const users = getUsers();
    users.push({ name, username, email, password });
    localStorage.setItem('aura_users', JSON.stringify(users));
  }

  // ----------------------------------------------------
  // SECTION 1: Google OAuth SDK Integration
  // ----------------------------------------------------
  const googleBtnWrapper = document.getElementById('google-btn-wrapper');
  
  window.handleCredentialResponse = async (response) => {
    try {
      // Decode credential JWT payload (client-side decode helper)
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const profile = JSON.parse(jsonPayload);
      
      // Persist Google User into Neon DB
      try {
        const apiRes = await fetch('/api/google-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: profile.name,
            email: profile.email,
            picture: profile.picture
          })
        });

        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData.success && apiData.user) {
            const session = {
              name: apiData.user.name,
              username: apiData.user.username,
              email: apiData.user.email,
              picture: apiData.user.picture,
              method: 'google'
            };
            localStorage.setItem('aura_session', JSON.stringify(session));
            showToast(`Welcome, ${profile.name}! Saved to Neon DB...`, 'success');
            setTimeout(() => {
              window.location.href = 'index.html';
            }, 1200);
            return;
          }
        }
      } catch (apiErr) {
        console.warn("Neon DB Google Auth API offline, using local session fallback:", apiErr);
      }

      // Store local session fallback
      const session = {
        name: profile.name,
        username: profile.email ? profile.email.split('@')[0] : profile.name,
        email: profile.email,
        picture: profile.picture,
        method: 'google'
      };
      
      localStorage.setItem('aura_session', JSON.stringify(session));
      showToast(`Welcome, ${profile.name}! Redirecting...`, 'success');

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1200);

    } catch (err) {
      console.error("Google JWT decode error:", err);
      showToast("Authentication failure via Google.", "error");
    }
  };

  function initGoogleAuth() {
    if (googleBtnWrapper && window.google) {
      window.google.accounts.id.initialize({
        client_id: '928062303691-egh5oimhhoh4l5ghav1ckcusr0o9atda.apps.googleusercontent.com',
        callback: window.handleCredentialResponse
      });
      window.google.accounts.id.renderButton(
        googleBtnWrapper,
        { theme: 'outline', size: 'large', width: googleBtnWrapper.clientWidth }
      );
    }
  }

  // Load Google SDK if page has wrapper
  if (googleBtnWrapper) {
    // Retry initialization in case script loads asynchronously
    let retries = 0;
    const interval = setInterval(() => {
      if (window.google) {
        initGoogleAuth();
        clearInterval(interval);
      } else if (retries > 20) {
        clearInterval(interval);
        console.warn("Google SDK timed out loading.");
      }
      retries++;
    }, 100);
  }


  // ----------------------------------------------------
  // SECTION 2: Form Submissions
  // ----------------------------------------------------

  // 1. Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const usernameInput = document.getElementById('username');
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = document.getElementById('password').value;

      if (!username || !password) {
        showToast("Please fill in all details.", "error");
        return;
      }

      // 1. Try Vercel / Neon DB Serverless API
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            const session = {
              name: data.user.name,
              username: data.user.username,
              email: data.user.email,
              method: 'neon-db'
            };
            localStorage.setItem('aura_session', JSON.stringify(session));
            showToast("Success! Authenticated via Neon DB...", "success");
            setTimeout(() => {
              window.location.href = 'index.html';
            }, 1200);
            return;
          }
        } else if (response.status === 401 || response.status === 400) {
          const data = await response.json();
          showToast(data.message || "Invalid username or password combination.", "error");
          return;
        }
      } catch (err) {
        console.warn("Backend API endpoint offline, checking local storage:", err);
      }

      // 2. Fallback local storage check (for offline/static preview)
      const users = getUsers();
      const matched = users.find(u => 
        (u.username && u.username.toLowerCase() === username.toLowerCase()) || 
        (u.name && u.name.toLowerCase() === username.toLowerCase()) ||
        (u.email && u.email.toLowerCase() === username.toLowerCase())
      );

      if (matched && matched.password === password) {
        const session = {
          name: matched.name,
          username: matched.username || username,
          email: matched.email || '',
          method: 'credentials'
        };
        localStorage.setItem('aura_session', JSON.stringify(session));
        showToast("Success! Entering workspace...", "success");
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1200);
      } else {
        showToast("Invalid username or password combination.", "error");
      }
    });
  }

  // 2. Sign Up Form
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (!name || !email || !password || !confirmPassword) {
        showToast("All fields are required.", "error");
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showToast("Please specify a valid email address.", "error");
        return;
      }

      if (password.length < 6) {
        showToast("Password must span at least 6 characters.", "error");
        return;
      }

      if (password !== confirmPassword) {
        showToast("Passwords do not match.", "error");
        return;
      }

      // 1. Try Vercel / Neon DB Serverless API
      try {
        const response = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            const session = {
              name: data.user.name,
              username: data.user.username,
              email: data.user.email,
              method: 'neon-db'
            };
            localStorage.setItem('aura_session', JSON.stringify(session));
            showToast("Account saved to Neon DB! Entering workspace...", "success");
            setTimeout(() => {
              window.location.href = 'index.html';
            }, 1200);
            return;
          }
        } else if (response.status === 400 || response.status === 409) {
          const data = await response.json();
          showToast(data.message || "This email address is already registered.", "error");
          return;
        }
      } catch (err) {
        console.warn("Backend API endpoint offline, saving to local storage fallback:", err);
      }

      // 2. Fallback local storage check
      const users = getUsers();
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        showToast("This email address is already registered.", "error");
        return;
      }

      const username = email.split('@')[0] || name.toLowerCase().replace(/\s+/g, '');
      saveUser(name, username, email, password);
      const session = {
        name,
        username,
        email,
        method: 'credentials'
      };
      localStorage.setItem('aura_session', JSON.stringify(session));
      showToast("Account created successfully! Loading workspace...", "success");

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1200);
    });
  }

  // 3. Forgot Form
  const forgotForm = document.getElementById('forgot-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value.trim();
      if (!email) {
        showToast("Please provide your email address.", "error");
        return;
      }

      const users = getUsers();
      const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (exists) {
        // Mock token generation
        localStorage.setItem('aura_recovery_email', exists.email);
        localStorage.setItem('aura_recovery_code', '123456');
        
        showToast("Verification code generated: 123456", "success");
        setTimeout(() => {
          window.location.href = 'reset-password.html';
        }, 2000);
      } else {
        showToast("Email address not found in system.", "error");
      }
    });
  }

  // 4. Reset Form
  const resetForm = document.getElementById('reset-form');
  if (resetForm) {
    resetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const code = document.getElementById('code').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (!code || !password || !confirmPassword) {
        showToast("All fields are required.", "error");
        return;
      }

      const recoveryEmail = localStorage.getItem('aura_recovery_email');
      const recoveryCode = localStorage.getItem('aura_recovery_code');

      if (!recoveryEmail || !recoveryCode || code !== recoveryCode) {
        showToast("Invalid recovery code.", "error");
        return;
      }

      if (password.length < 6) {
        showToast("Password must span at least 6 characters.", "error");
        return;
      }

      if (password !== confirmPassword) {
        showToast("Passwords do not match.", "error");
        return;
      }

      // Update password in local DB
      const users = getUsers();
      const updated = users.map(u => {
        if (u.email.toLowerCase() === recoveryEmail.toLowerCase()) {
          return { ...u, password: password };
        }
        return u;
      });

      localStorage.setItem('aura_users', JSON.stringify(updated));
      localStorage.removeItem('aura_recovery_email');
      localStorage.removeItem('aura_recovery_code');

      showToast("Password updated! Redirecting to login...", "success");
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    });
  }
});
