(function () {
    var token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    var taskList = document.getElementById("task-list");
    var addTaskBtn = document.getElementById("add-task-btn");
    var addTaskForm = document.getElementById("add-task-form");
    var saveTaskBtn = document.getElementById("save-task-btn");
    var cancelTaskBtn = document.getElementById("cancel-task-btn");
    var taskError = document.getElementById("task-error");
    var adminSection = document.getElementById("admin-section");
    var adminTaskList = document.getElementById("admin-task-list");
    var assignTaskApi = window.assignTask;

    if (!taskList) return;

    // Toggle add task form
    addTaskBtn.addEventListener("click", function () {
        addTaskForm.classList.toggle("hidden");
    });

    cancelTaskBtn.addEventListener("click", function () {
        addTaskForm.classList.add("hidden");
        clearTaskForm();
    });

    // Save new task
    saveTaskBtn.addEventListener("click", async function () {
        var title = document.getElementById("task-title").value.trim();
        var description = document.getElementById("task-description").value.trim();
        var dueDate = document.getElementById("task-due-date").value;

        if (!title || !dueDate) {
            taskError.textContent = "Title and due date are required.";
            return;
        }

        try {
            taskError.textContent = "";
            await createTask(title, description, dueDate);
            clearTaskForm();
            addTaskForm.classList.add("hidden");
            await loadTasks();
        } catch (err) {
            taskError.textContent = err.message;
        }
    });

    // Load tasks
    var currentUser = null;
    var usersCache = [];

    function handleAuthError(err) {
        if (err.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return true;
        }
        return false;
    }

    async function loadTasks() {
        if (!currentUser) {
            try {
                currentUser = await fetchCurrentUser();
            } catch (err) {
                if (handleAuthError(err)) return;
            }
        }

        try {
            var tasks = await fetchTasks();
            renderTasks(tasks);
        } catch (err) {
            if (handleAuthError(err)) return;
            taskList.innerHTML = "<p>Failed to load tasks.</p>";
        }

        if (!currentUser || currentUser.role !== "admin") {
            adminSection.classList.add("hidden");
            return;
        }

        try {
            adminSection.classList.remove("hidden");
            var results = await Promise.all([fetchAllTasks(), fetchUsers()]);
            usersCache = results[1];
            renderAdminTasks(results[0]);
        } catch (err) {
            if (handleAuthError(err)) return;
            adminTaskList.innerHTML = "<p>Failed to load admin tasks.</p>";
        }
    }

    function isOverdue(task) {
        return task.status !== "completed" && new Date(task.due_date) < new Date();
    }

    function taskMetaHtml(task, extra) {
        var statusLabel = task.status.replace("_", " ");
        return '<div class="task-meta">' +
                '<span class="task-status status-' + task.status + '">' + escapeHtml(statusLabel) + '</span>' +
                (isOverdue(task) ? '<span class="task-status status-overdue">Overdue</span>' : '') +
                '<span>Due: ' + escapeHtml(new Date(task.due_date).toLocaleString()) + '</span>' +
                (extra || '') +
            '</div>';
    }

    function renderTasks(tasks) {
        taskList.innerHTML = "";
        if (tasks.length === 0) {
            taskList.innerHTML = "<p>No tasks yet. Create one to get started.</p>";
            return;
        }
        tasks.forEach(function (task) {
            var card = document.createElement("div");
            card.className = "task-card";

            var isOwner = currentUser && task.user_id === currentUser.id;
            var isAdmin = currentUser && currentUser.role === "admin";
            var relation = isOwner ?
                (task.assigned_to === (currentUser && currentUser.id) ? "Created by you, assigned to you" : "Created by you") :
                "Assigned to you";

            card.innerHTML =
                '<div class="task-info">' +
                    '<h3>' + escapeHtml(task.title) + '</h3>' +
                    (task.description ? '<p>' + escapeHtml(task.description) + '</p>' : '') +
                    taskMetaHtml(task, '<span>' + relation + '</span>') +
                '</div>' +
                '<div class="task-actions">' +
                    '<button class="edit-btn" onclick="toggleStatus(' + task.id + ', \'' + task.status + '\')">Cycle Status</button>' +
                    (isOwner || isAdmin ? '<button class="delete-btn" onclick="removeTask(' + task.id + ')">Delete</button>' : '') +
                '</div>';

            taskList.appendChild(card);
        });
    }

    function renderAdminTasks(tasks) {
        adminTaskList.innerHTML = "";
        if (tasks.length === 0) {
            adminTaskList.innerHTML = "<p>No tasks in the system.</p>";
            return;
        }

        tasks.forEach(function (task) {
            var card = document.createElement("div");
            card.className = "task-card";

            var assignedLabel = task.assigned_to ?
                (usersCache.find(function(u) { return u.id === task.assigned_to; }) || {}).email || "User #" + task.assigned_to :
                "Unassigned";
            var assignmentOptions = '<option value="" disabled' + (task.assigned_to ? '' : ' selected') + '>Assign to...</option>';
            if (task.assigned_to) {
                assignmentOptions += '<option value="none">Unassign</option>';
            }
            usersCache.forEach(function (u) {
                var selected = u.id === task.assigned_to ? " selected" : "";
                assignmentOptions += '<option value="' + u.id + '"' + selected + '>' + escapeHtml(u.email) + ' (' + u.role + ')</option>';
            });

            card.innerHTML =
                '<div class="task-info">' +
                    '<h3>' + escapeHtml(task.title) + '</h3>' +
                    (task.description ? '<p>' + escapeHtml(task.description) + '</p>' : '') +
                    taskMetaHtml(task, '<span>Assigned: ' + escapeHtml(assignedLabel) + '</span>') +
                '</div>' +
                '<div class="task-actions">' +
                    '<select onchange="assignTask(' + task.id + ', this.value)" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:12px;">' + assignmentOptions + '</select>' +
                    '<button class="edit-btn" onclick="toggleStatus(' + task.id + ', \'' + task.status + '\')">Cycle</button>' +
                    '<button class="delete-btn" onclick="removeTask(' + task.id + ')">Delete</button>' +
                '</div>';

            adminTaskList.appendChild(card);
        });
    }

    function escapeHtml(text) {
        var div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function clearTaskForm() {
        document.getElementById("task-title").value = "";
        document.getElementById("task-description").value = "";
        document.getElementById("task-due-date").value = "";
    }

    // Global functions for inline event handlers
    window.removeTask = async function (taskId) {
        if (!confirm("Delete this task?")) return;
        try {
            await deleteTask(taskId);
            await loadTasks();
        } catch (err) {
            alert("Failed to delete task: " + err.message);
        }
    };

    window.toggleStatus = async function (taskId, currentStatus) {
        var nextStatus = currentStatus === "pending" ? "in_progress" :
                         currentStatus === "in_progress" ? "completed" : "pending";
        try {
            await updateTask(taskId, { status: nextStatus });
            await loadTasks();
        } catch (err) {
            alert("Failed to update task: " + err.message);
        }
    };

    window.assignTask = async function (taskId, userId) {
        if (!userId) return;
        try {
            await assignTaskApi(taskId, userId === "none" ? null : parseInt(userId, 10));
            await loadTasks();
        } catch (err) {
            alert("Failed to assign task: " + err.message);
        }
    };

    // Initial load
    loadTasks();
})();
