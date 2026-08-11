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
            renderTasks(adminTasks, adminTaskList, true);
        } catch (err) {
            // Not an admin, hide admin section
            adminSection.classList.add("hidden");
        }
    }

    function renderTasks(tasks, container, isAdmin) {
        container.innerHTML = "";
        if (tasks.length === 0) {
            container.innerHTML = "<p>No tasks found.</p>";
            return;
        }
        tasks.forEach(function (task) {
            var card = document.createElement("div");
            card.className = "task-card";

            var statusClass = "status-" + task.status.replace(" ", "_");
            var dueDateStr = new Date(task.due_date).toLocaleString();

            var actionsHtml = "";
            if (!isAdmin || isAdmin) {
                actionsHtml = '<div class="task-actions">' +
                    '<button class="edit-btn" onclick="toggleStatus(' + task.id + ', \'' + task.status + '\')">Toggle Status</button>' +
                    '<button class="delete-btn" onclick="removeTask(' + task.id + ')">Delete</button>' +
                    '</div>';
            }

            card.innerHTML =
                '<div class="task-info">' +
                    '<h3>' + escapeHtml(task.title) + '</h3>' +
                    (task.description ? '<p>' + escapeHtml(task.description) + '</p>' : '') +
                    '<div class="task-meta">' +
                        '<span class="task-status ' + statusClass + '">' + escapeHtml(task.status) + '</span>' +
                        '<span>Due: ' + dueDateStr + '</span>' +
                    '</div>' +
                '</div>' +
                actionsHtml;

            container.appendChild(card);
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

    // Initial load
    loadTasks();
})();
