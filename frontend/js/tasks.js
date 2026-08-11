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
    var usersCache = [];

    async function loadTasks() {
        try {
            var tasks = await fetchTasks();
            renderTasks(tasks, taskList, false);
        } catch (err) {
            taskList.innerHTML = "<p>Failed to load tasks.</p>";
        }

        // Try loading admin tasks
        try {
            var adminTasks = await fetchAllTasks();
            adminSection.classList.remove("hidden");
            // Load users for assignment dropdown
            try {
                usersCache = await fetchUsers();
            } catch (e) {
                usersCache = [];
            }
            renderAdminTasks(adminTasks);
        } catch (err) {
            // Not an admin, hide admin section
            adminSection.classList.add("hidden");
        }
    }

    function renderTasks(tasks, container) {
        container.innerHTML = "";
        if (tasks.length === 0) {
            container.innerHTML = "<p>No tasks yet. Create one to get started.</p>";
            return;
        }
        tasks.forEach(function (task) {
            var card = document.createElement("div");
            card.className = "task-card";

            var statusClass = "status-" + task.status.replace(" ", "_");
            var dueDateStr = new Date(task.due_date).toLocaleDateString();

            card.innerHTML =
                '<div class="task-info">' +
                    '<h3>' + escapeHtml(task.title) + '</h3>' +
                    (task.description ? '<p>' + escapeHtml(task.description) + '</p>' : '') +
                    '<div class="task-meta">' +
                        '<span class="task-status ' + statusClass + '">' + escapeHtml(task.status) + '</span>' +
                        '<span>Due: ' + dueDateStr + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="task-actions">' +
                    '<button class="edit-btn" onclick="toggleStatus(' + task.id + ', \'' + task.status + '\')">Cycle Status</button>' +
                    '<button class="delete-btn" onclick="removeTask(' + task.id + ')">Delete</button>' +
                '</div>';

            container.appendChild(card);
        });
    }

    function renderAdminTasks(tasks) {
        adminTaskList.innerHTML = "";
        if (tasks.length === 0) {
            adminTaskList.innerHTML = "<p>No tasks in the system.</p>";
            return;
        }

        var selectOptions = '<option value="">Assign to...</option>';
        usersCache.forEach(function (u) {
            selectOptions += '<option value="' + u.id + '">' + escapeHtml(u.email) + ' (' + u.role + ')</option>';
        });

        tasks.forEach(function (task) {
            var card = document.createElement("div");
            card.className = "task-card";

            var statusClass = "status-" + task.status.replace(" ", "_");
            var dueDateStr = new Date(task.due_date).toLocaleDateString();
            var assignedLabel = task.assigned_to ?
                (usersCache.find(function(u) { return u.id === task.assigned_to; }) || {}).email || "User #" + task.assigned_to :
                "Unassigned";

            card.innerHTML =
                '<div class="task-info">' +
                    '<h3>' + escapeHtml(task.title) + '</h3>' +
                    (task.description ? '<p>' + escapeHtml(task.description) + '</p>' : '') +
                    '<div class="task-meta">' +
                        '<span class="task-status ' + statusClass + '">' + escapeHtml(task.status) + '</span>' +
                        '<span>Due: ' + dueDateStr + '</span>' +
                        '<span>Assigned: ' + escapeHtml(assignedLabel) + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="task-actions">' +
                    '<select onchange="assignTask(' + task.id + ', this.value)" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:12px;">' + selectOptions + '</select>' +
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
            await assignTask(taskId, parseInt(userId));
            await loadTasks();
        } catch (err) {
            alert("Failed to assign task: " + err.message);
        }
    };

    // Initial load
    loadTasks();
})();
