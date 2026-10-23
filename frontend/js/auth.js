(function () {
    // Dashboard and onboarding: just the log-out button
    var logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () { Session.signOut(); });
    }

    var card = document.querySelector(".auth-card");
    if (!card) return;

    var params = new URLSearchParams(window.location.search);
    var panels = card.querySelectorAll("[data-panel]");
    var loginForm = document.getElementById("login-form");
    var registerForm = document.getElementById("register-form");

    function show(name) {
        panels.forEach(function (p) { p.classList.toggle("hidden", p.dataset.panel !== name); });
        var first = card.querySelector('[data-panel="' + name + '"] input');
        if (first && name !== "signin") first.focus();
    }

    function busy(line) {
        document.getElementById("busy-line").textContent = line;
        show("busy");
    }

    function fail(id, err) {
        document.getElementById(id).textContent = (err && err.message) || String(err);
    }

    // Supabase reports failed redirects in the query string or the hash
    function urlError() {
        var hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        return params.get("error_description") || hash.get("error_description");
    }

    // ---------- Invite links ----------
    var banner = document.getElementById("invite-banner");
    if (params.get("invite")) {
        Session.savePendingInvite(params.get("invite"));
    }

    async function showInviteBanner() {
        var token = Session.pendingInvite();
        if (!token) return;
        try {
            var invite = await checkInvite(token);
            if (invite.valid) {
                banner.textContent = invite.invited_by + " invited you! Sign in or sign up to join.";
            } else {
                banner.textContent = "This invite link has expired or was already used. Ask for a new one.";
                Session.clearPendingInvite();
            }
            banner.classList.remove("hidden");
        } catch (e) { /* the banner is a nicety */ }
    }

    // ---------- After sign-in: member, invited friend, or stranger ----------
    async function routeSignedIn() {
        busy("Waking up your bugs…");
        try {
            var user = await fetchCurrentUser();
            Session.clearPendingInvite();
            goHome(user);
        } catch (err) {
            if (err.status === 403 && err.message === "invite_required") return joinOrWait();
            if (err.status === 401) return Session.signOut();
            show("signin");
            fail("provider-error", err);
        }
    }

    async function joinOrWait() {
        var token = Session.pendingInvite();
        if (token) {
            busy("Joining the group…");
            try {
                var user = await acceptInvite(token);
                Session.clearPendingInvite();
                goHome(user);
                return;
            } catch (err) {
                Session.clearPendingInvite();
                document.getElementById("invite-error").textContent = err.message;
            }
        }
        show("invite-needed");
    }

    function goHome(user) {
        window.location.replace(Critters.loadBuddy(user.id) ? "dashboard.html" : "onboarding.html");
    }

    // ---------- Sign-in methods ----------
    card.querySelectorAll("[data-provider]").forEach(function (btn) {
        btn.addEventListener("click", async function () {
            btn.disabled = true;
            var result = await Session.signInWithProvider(btn.dataset.provider);
            if (result.error) {
                btn.disabled = false;
                fail("provider-error", result.error);
            }
            // Otherwise the browser is already on its way to Google/Microsoft
        });
    });

    card.querySelectorAll(".tab-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            card.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
            loginForm.classList.toggle("active", btn.dataset.tab === "login");
            registerForm.classList.toggle("active", btn.dataset.tab === "register");
        });
    });

    card.querySelectorAll("[data-show]").forEach(function (btn) {
        btn.addEventListener("click", function () { show(btn.dataset.show); });
    });

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        var result = await Session.signInWithPassword(
            document.getElementById("login-email").value.trim(),
            document.getElementById("login-password").value
        );
        if (result.error) return fail("login-error", result.error);
        routeSignedIn();
    });

    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        var email = document.getElementById("register-email").value.trim();
        var result = await Session.signUp(
            email,
            document.getElementById("register-password").value,
            document.getElementById("register-name").value.trim()
        );
        if (result.error) return fail("register-error", result.error);
        if (result.data.session) return routeSignedIn();
        document.getElementById("sent-line").textContent =
            "We sent a confirmation link to " + email + ". Open it on this device to finish signing up.";
        show("sent");
    });

    document.getElementById("forgot-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        var email = document.getElementById("forgot-email").value.trim();
        var result = await Session.sendPasswordReset(email);
        if (result.error) return fail("forgot-error", result.error);
        document.getElementById("sent-line").textContent = "If " + email + " has an account, a reset link is on its way.";
        show("sent");
    });

    document.getElementById("newpass-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        var result = await Session.setPassword(document.getElementById("newpass").value);
        if (result.error) return fail("newpass-error", result.error);
        window.history.replaceState(null, "", "login.html");
        routeSignedIn();
    });

    document.getElementById("signout-btn").addEventListener("click", function () { Session.signOut(); });

    // ---------- Boot ----------
    showInviteBanner();
    Session.client.auth.getSession().then(function (result) {
        var session = result.data.session;
        if (session && params.get("reset")) return show("newpass");
        if (session) return routeSignedIn();
        show("signin");
        var error = urlError();
        if (error) fail("provider-error", error);
    });
})();
