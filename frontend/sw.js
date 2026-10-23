// Keeps a copy of the app shell on the phone so the home-screen app still opens without signal.
// Pages and scripts come from the network first, so a deploy shows up on the next launch.
// API and Supabase requests are never cached, so tasks are never stale.
var CACHE = "tasktion-shell-v4";
var SHELL = ["/pages/login.html", "/pages/dashboard.html", "/pages/onboarding.html"];
var STATIC_PREFIXES = ["/pages/", "/css/", "/js/", "/icons/"];
var PINNED_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", function (event) {
    event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }));
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (keys) {
                return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
            })
            .then(function () { return self.clients.claim(); })
    );
});

function networkFirst(request, key) {
    return caches.open(CACHE).then(function (cache) {
        return fetch(request)
            .then(function (response) {
                if (response.ok) cache.put(key, response.clone());
                return response;
            })
            .catch(function () {
                return cache.match(key).then(function (cached) { return cached || Promise.reject(new Error("offline")); });
            });
    });
}

// Version-pinned CDN files never change, so the cached copy is always right
function cacheFirst(request) {
    return caches.open(CACHE).then(function (cache) {
        return cache.match(request).then(function (cached) {
            return cached || fetch(request).then(function (response) {
                if (response.ok || response.type === "opaque") cache.put(request, response.clone());
                return response;
            });
        });
    });
}

self.addEventListener("fetch", function (event) {
    var request = event.request;
    if (request.method !== "GET") return;
    var url = new URL(request.url);

    if (url.origin === self.location.origin) {
        // /js/config.js comes from the server's environment; always fetch it
        if (url.pathname === "/js/config.js") return;
        if (!STATIC_PREFIXES.some(function (p) { return url.pathname.indexOf(p) === 0; })) return;
        // Sign-in redirects add ?code=…; cache the page itself, not each visit
        var key = request.mode === "navigate" ? url.origin + url.pathname : request;
        event.respondWith(networkFirst(request, key));
    } else if (PINNED_HOSTS.indexOf(url.hostname) !== -1) {
        event.respondWith(cacheFirst(request));
    }
});
