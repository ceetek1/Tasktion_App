// Supabase Auth session: sign-in providers, the token for API calls, sign-out.
// Needs supabase-js and /js/config.js loaded first.
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () { /* the app works without it */ });
}

var Session = (function () {
    var client = window.supabase.createClient(window.TASKTION_SUPABASE_URL, window.TASKTION_SUPABASE_KEY, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    var INVITE_KEY = "tasktion.invite";

    function pageUrl(page, query) {
        return new URL(page + (query || ""), window.location.href).href;
    }

    function store(fn) {
        try { return fn(window.localStorage); } catch (e) { return null; }
    }

    return {
        client: client,

        getToken: async function () {
            var result = await client.auth.getSession();
            return result.data.session ? result.data.session.access_token : null;
        },

        // Full-page redirect, not a popup: popups get stuck in an iPhone home-screen app
        signInWithProvider: function (provider) {
            var options = { redirectTo: pageUrl("login.html") };
            if (provider === "azure") options.scopes = "email";
            return client.auth.signInWithOAuth({ provider: provider, options: options });
        },

        signInWithPassword: function (email, password) {
            return client.auth.signInWithPassword({ email: email, password: password });
        },

        signUp: function (email, password, name) {
            return client.auth.signUp({
                email: email,
                password: password,
                options: { emailRedirectTo: pageUrl("login.html"), data: name ? { full_name: name } : {} }
            });
        },

        sendPasswordReset: function (email) {
            return client.auth.resetPasswordForEmail(email, { redirectTo: pageUrl("login.html", "?reset=1") });
        },

        setPassword: function (password) {
            return client.auth.updateUser({ password: password });
        },

        signOut: async function () {
            var result = null;
            try { result = await client.auth.signOut(); } catch (e) { /* handled below */ }
            if (!result || result.error) {
                // supabase-js keeps the session when it can't reach Supabase (e.g. offline); drop it here anyway
                var key = client.auth.storageKey;
                store(function (s) { s.removeItem(key); s.removeItem(key + "-code-verifier"); });
            }
            window.location.href = "login.html";
        },

        // An invite link survives the trip out to Google/Microsoft and back
        savePendingInvite: function (token) { store(function (s) { s.setItem(INVITE_KEY, token); }); },
        pendingInvite: function () { return store(function (s) { return s.getItem(INVITE_KEY); }); },
        clearPendingInvite: function () { store(function (s) { s.removeItem(INVITE_KEY); }); }
    };
})();
