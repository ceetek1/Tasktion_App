(function () {
    // Tab switching on login page
    const tabBtns = document.querySelectorAll(".tab-btn");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    tabBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
            tabBtns.forEach(function (b) { b.classList.remove("active"); });
            loginForm.classList.remove("active");
            registerForm.classList.remove("active");
            btn.classList.add("active");
            if (btn.dataset.tab === "login") {
                loginForm.classList.add("active");
            } else {
                registerForm.classList.add("active");
            }
        });
    });

    // Check if we're on the login page
    if (loginForm && registerForm) {
        // Redirect to dashboard if already logged in
        if (localStorage.getItem("token")) {
            window.location.href = "dashboard.html";
            return;
        }

        // Login
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var email = document.getElementById("login-email").value;
            var password = document.getElementById("login-password").value;
            var errorEl = document.getElementById("login-error");
            try {
                var result = await login(email, password);
                localStorage.setItem("token", result.access_token);
                window.location.href = "dashboard.html";
            } catch (err) {
                errorEl.textContent = err.message;
            }
        });

        // Register
        registerForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var email = document.getElementById("register-email").value;
            var password = document.getElementById("register-password").value;
            var errorEl = document.getElementById("register-error");
            try {
                await register(email, password);
                // Auto-login after registration
                var result = await login(email, password);
                localStorage.setItem("token", result.access_token);
                window.location.href = "dashboard.html";
            } catch (err) {
                errorEl.textContent = err.message;
            }
        });
    }

    // Dashboard page
    var logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        var token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "login.html";
            return;
        }

        // Decode token to get user info (simple base64 decode)
        try {
            var payload = token.split(".")[1];
            var padding = 4 - payload.length % 4;
            if (padding !== 4) payload += "=".repeat(padding);
            var decoded = JSON.parse(atob(payload));
            var userEmailEl = document.getElementById("user-email");
            if (userEmailEl) {
                userEmailEl.textContent = "User #" + decoded.sub;
            }
        } catch (e) {
            // Token decode failed, show generic label
            var userEmailEl = document.getElementById("user-email");
            if (userEmailEl) userEmailEl.textContent = "Logged in";
        }

        logoutBtn.addEventListener("click", function () {
            localStorage.removeItem("token");
            window.location.href = "login.html";
        });
    }
})();
