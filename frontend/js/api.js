const API_BASE = "http://127.0.0.1:8000";

async function apiRequest(method, path, body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (body) options.body = JSON.stringify(body);

    const token = localStorage.getItem("token");
    if (token) {
        options.headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, options);
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || "Request failed");
    }
    return data;
}

// Auth
async function register(email, password) {
    return apiRequest("POST", "/auth/register", { email, password });
}

async function login(email, password) {
    return apiRequest("POST", "/auth/login", { email, password });
}

async function registerAdmin(email, password, adminSecret) {
    const response = await fetch(`${API_BASE}/auth/register-admin`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || "Registration failed");
    }
    return data;
}

// Tasks
async function fetchTasks() {
    return apiRequest("GET", "/tasks");
}

async function createTask(title, description, dueDate) {
    return apiRequest("POST", "/tasks", {
        title,
        description,
        due_date: new Date(dueDate).toISOString(),
    });
}

async function updateTask(taskId, updates) {
    return apiRequest("PATCH", `/tasks/${taskId}`, updates);
}

async function deleteTask(taskId) {
    return apiRequest("DELETE", `/tasks/${taskId}`);
}

// Admin
async function fetchAllTasks() {
    return apiRequest("GET", "/admin/tasks");
}

async function assignTask(taskId, userId) {
    return apiRequest("PATCH", `/admin/tasks/${taskId}/assign`, { assigned_to: userId });
}

async function fetchUsers() {
    return apiRequest("GET", "/users");
}
