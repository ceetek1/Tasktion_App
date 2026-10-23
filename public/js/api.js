const API_BASE = (window.TASKTION_API_BASE || "").replace(/\/$/, "");

function apiUrl(path) {
    return API_BASE ? `${API_BASE}${path}` : path;
}

function formatError(data, fallback) {
    if (!data || !data.detail) return fallback;
    if (Array.isArray(data.detail)) {
        // FastAPI validation errors: [{loc, msg, ...}]
        return data.detail.map(function (d) {
            var field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
            var msg = (d.msg || "").replace(/^Value error, /, "");
            return field && field !== "body" ? field + ": " + msg : msg;
        }).join("; ");
    }
    return String(data.detail);
}

async function apiRequest(method, path, body = null, extraHeaders = {}) {
    const options = {
        method,
        headers: Object.assign({ "Content-Type": "application/json" }, extraHeaders),
    };
    if (body) options.body = JSON.stringify(body);

    const token = await Session.getToken();
    if (token) {
        options.headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(apiUrl(path), options);
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
        const error = new Error(formatError(data, response.statusText || "Request failed"));
        error.status = response.status;
        throw error;
    }
    return data;
}

// Auth
async function fetchCurrentUser() {
    return apiRequest("GET", "/auth/me");
}

// Invites
async function createInvite() {
    return apiRequest("POST", "/invites");
}

async function checkInvite(token) {
    return apiRequest("GET", `/invites/${encodeURIComponent(token)}`);
}

async function acceptInvite(token) {
    return apiRequest("POST", `/invites/${encodeURIComponent(token)}/accept`);
}

// Tasks
async function fetchTasks() {
    return apiRequest("GET", "/tasks");
}

async function createTask(title, description, dueDate, assignedTo) {
    return apiRequest("POST", "/tasks", {
        title,
        description,
        due_date: new Date(dueDate).toISOString(),
        assigned_to: assignedTo,
    });
}

async function updateTask(taskId, updates) {
    return apiRequest("PATCH", `/tasks/${taskId}`, updates);
}

async function deleteTask(taskId) {
    return apiRequest("DELETE", `/tasks/${taskId}`);
}

// Group
async function fetchUsers() {
    return apiRequest("GET", "/users");
}
