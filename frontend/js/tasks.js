(function () {
    var token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    var C = window.Critters;
    var taskList = document.getElementById("task-list");
    if (!taskList) return;

    var STATUS = [
        { id: "pending", label: "To do", hint: "not started" },
        { id: "in_progress", label: "Doing it", hint: "in progress" },
        { id: "completed", label: "Squashed!", hint: "all done" }
    ];
    var FILTERS = [
        { id: "all", label: "All", test: function () { return true; } },
        { id: "pending", label: "To do", test: function (t) { return t.status === "pending"; } },
        { id: "in_progress", label: "Doing it", test: function (t) { return t.status === "in_progress"; } },
        { id: "completed", label: "Squashed", test: function (t) { return t.status === "completed"; } },
        { id: "overdue", label: "Overdue", test: function (t) { return C.isOverdue(t); } }
    ];

    var state = {
        user: null,
        buddy: null,
        tasks: [],
        allTasks: [],
        users: [],
        filter: "all",
        editing: null,
        detailId: null
    };

    var els = {
        loading: document.getElementById("task-loading"),
        empty: document.getElementById("task-empty"),
        filters: document.getElementById("filters"),
        adminSection: document.getElementById("admin-section"),
        adminList: document.getElementById("admin-task-list"),
        taskDialog: document.getElementById("task-dialog"),
        taskForm: document.getElementById("task-form"),
        detailDialog: document.getElementById("detail-dialog"),
        detail: document.getElementById("detail"),
        toast: document.getElementById("toast")
    };

    document.getElementById("brand-bug").innerHTML = C.critter("ladybug", "#EF476F", { size: 40 });
    document.getElementById("buddy-hill").innerHTML = C.hill();

    // ---------- Helpers ----------
    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) {
            if (k === "text") node.textContent = attrs[k];
            else if (k === "html") node.innerHTML = attrs[k];
            else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2), attrs[k]);
            else node.setAttribute(k, attrs[k]);
        });
        (children || []).forEach(function (c) { if (c) node.appendChild(c); });
        return node;
    }

    var ICONS = {
        cal: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><g class="i"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></g></svg>',
        person: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><g class="i"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></g></svg>',
        tick: '<svg class="tick" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path class="i" stroke-width="3.6" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path class="i" stroke-width="3" d="M6 6l12 12M18 6L6 18"/></svg>',
        pencil: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path class="i" d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/></svg>',
        trash: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path class="i" d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
        notepad: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g class="i"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/></g></svg>',
        check: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path class="i" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        sun: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><g class="i"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></g></svg>',
        flame: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4.5 2-7 2 1 3 3.5 3 3.5 0-3.5-1-5.5 1-8.5z" fill="#FFD166" stroke="#235789" stroke-width="2" stroke-linejoin="round"/></svg>',
        star: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path class="i" d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>',
        lock: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g class="i"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></g></svg>'
    };

    function sameDay(a, b) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    function formatWhen(date) {
        var now = new Date();
        var tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        var time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        if (sameDay(date, now)) return "Today, " + time;
        if (sameDay(date, tomorrow)) return "Tomorrow, " + time;
        return date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }) + ", " + time;
    }

    function overdueBy(date) {
        var mins = Math.round((Date.now() - date.getTime()) / 60000);
        if (mins < 60) return "Overdue by " + Math.max(mins, 1) + " min";
        var hours = Math.round(mins / 60);
        if (hours < 24) return "Overdue by " + hours + (hours === 1 ? " hour" : " hours");
        var days = Math.round(hours / 24);
        return "Overdue by " + days + (days === 1 ? " day" : " days");
    }

    function dueLabel(task) {
        var due = new Date(task.due_date);
        if (C.isOverdue(task)) return overdueBy(due);
        return (task.status === "completed" ? "Done · due " : "") + formatWhen(due);
    }

    function userEmail(id) {
        var u = state.users.filter(function (x) { return x.id === id; })[0];
        return u ? u.email : null;
    }

    function isMine(task) { return state.user && task.user_id === state.user.id; }
    function isAdmin() { return state.user && state.user.role === "admin"; }
    function canEdit(task) { return isMine(task) || isAdmin(); }

    function whoLabel(task) {
        var me = state.user && state.user.id;
        if (task.assigned_to === me && task.user_id === me) return "You";
        if (task.assigned_to === me) return "Assigned to you" + (userEmail(task.user_id) ? " by " + userEmail(task.user_id) : "");
        if (task.assigned_to) return "Assigned to " + (userEmail(task.assigned_to) || "a teammate");
        if (task.user_id === me) return "You (not assigned)";
        return "Created by " + (userEmail(task.user_id) || "a teammate");
    }

    function findTask(id) {
        return state.tasks.concat(state.allTasks).filter(function (t) { return t.id === id; })[0];
    }

    function replaceTask(updated) {
        [state.tasks, state.allTasks].forEach(function (list) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === updated.id) list[i] = updated;
            }
        });
    }

    function handleAuthError(err) {
        if (err && err.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "login.html";
            return true;
        }
        return false;
    }

    var toastTimer = null;
    function toast(title, line, oops) {
        document.getElementById("toast-title").textContent = title;
        document.getElementById("toast-line").textContent = line || "";
        els.toast.classList.toggle("oops", !!oops);
        els.toast.classList.remove("hidden", "show");
        void els.toast.offsetWidth;
        els.toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { els.toast.classList.add("hidden"); }, 2400);
    }

    // ---------- Header, buddy, badges ----------
    function renderProgress() {
        var p = C.progress(state.tasks);
        var streak = state.user ? C.streak(state.user.id) : 0;
        document.getElementById("level-num").textContent = p.level;
        document.getElementById("level-name").textContent = "Level " + p.level + " · " + p.levelName;
        document.getElementById("xp-text").textContent = p.xp + " / " + p.nextAt + " XP";
        document.getElementById("xp-fill").style.width = p.pct + "%";
        document.getElementById("xp-meter").setAttribute("aria-valuenow", p.pct);
        document.getElementById("streak-text").textContent = streak + "-day streak";

        var b = state.buddy;
        if (b) {
            var grumpy = p.overdue > 0;
            document.getElementById("buddy-svg").innerHTML = C.critter(b.species, b.color, {
                size: 150, grumpy: grumpy, label: b.name + ", " + (grumpy ? "a bit grumpy" : "happy")
            });
            document.getElementById("buddy-name").textContent = b.name;
            document.getElementById("buddy-mood").textContent = "Mood: " + (grumpy ? "a bit grumpy" : (state.tasks.length ? "over the moon" : "peckish"));
            var line = grumpy ? (p.overdue === 1 ? "psst… one task is going stinky" : "psst… " + p.overdue + " tasks are going stinky")
                : (state.tasks.length ? "you're on fire!! (not literally)" : "feed me a task?");
            document.getElementById("buddy-line").textContent = line;
        }

        var badges = [
            { name: "First Squash", earned: p.completed >= 1, bg: "var(--banana-wash)", icon: ICONS.check, iconBg: "var(--banana)" },
            { name: "Squash Squad (10)", earned: p.completed >= 10, bg: "var(--sky-wash)", icon: ICONS.star, iconBg: "var(--sky)" },
            { name: "5-Day Streak", earned: streak >= 5, bg: "var(--cherry-wash)", icon: ICONS.flame, iconBg: "var(--cherry)" },
            { name: "No Stinkers", earned: state.tasks.length > 0 && p.overdue === 0, bg: "var(--mint-wash)", icon: ICONS.sun, iconBg: "var(--mint)" }
        ];
        var list = document.getElementById("badges");
        list.innerHTML = "";
        badges.forEach(function (bd) {
            var li = el("li", { "class": "badge" + (bd.earned ? "" : " locked") });
            if (bd.earned) li.style.background = bd.bg;
            var icon = el("span", { "class": "badge-icon", html: bd.earned ? bd.icon : ICONS.lock });
            if (bd.earned) icon.style.background = bd.iconBg;
            li.appendChild(icon);
            li.appendChild(el("span", { text: bd.name + (bd.earned ? "" : " (locked)") }));
            list.appendChild(li);
        });
        document.getElementById("badge-count").textContent = badges.filter(function (x) { return x.earned; }).length + " of " + badges.length;
    }

    // ---------- Task list ----------
    function renderFilters() {
        els.filters.innerHTML = "";
        FILTERS.forEach(function (f) {
            var btn = el("button", {
                type: "button", "class": "filter", role: "tab", "aria-selected": String(state.filter === f.id),
                onclick: function () { state.filter = f.id; renderTasks(); }
            });
            btn.appendChild(document.createTextNode(f.label));
            btn.appendChild(el("span", { "class": "count", text: String(state.tasks.filter(f.test).length) }));
            els.filters.appendChild(btn);
        });
    }

    function taskCard(task, opts) {
        opts = opts || {};
        var done = task.status === "completed";
        var overdue = C.isOverdue(task);
        var statusDef = STATUS.filter(function (s) { return s.id === task.status; })[0] || STATUS[0];
        var li = el("li", { "class": "task" + (done ? " is-done" : "") + (overdue ? " is-overdue" : "") });

        li.appendChild(el("button", {
            type: "button", "class": "squash", "aria-pressed": String(done),
            "aria-label": (done ? "Un-squash " : "Squash ") + task.title + (done ? "" : " (mark done)"),
            html: ICONS.tick,
            onclick: function () { squash(task.id); }
        }));

        var body = el("div", { "class": "task-body" });
        var top = el("div", { "class": "task-top" });
        top.appendChild(el("button", { type: "button", "class": "task-title", text: task.title, onclick: function () { openDetail(task.id); } }));
        top.appendChild(el("span", { "class": "pill pill-" + task.status, text: statusDef.label }));
        body.appendChild(top);
        if (task.description) body.appendChild(el("p", { "class": "task-desc", text: task.description }));

        var meta = el("div", { "class": "meta" });
        var dueTag = el("span", { "class": "tag" + (overdue ? " tag-overdue" : (done ? " tag-done" : "")), html: ICONS.cal });
        dueTag.appendChild(document.createTextNode(dueLabel(task)));
        meta.appendChild(dueTag);
        var whoTag = el("span", { "class": "tag", html: ICONS.person });
        whoTag.appendChild(document.createTextNode(whoLabel(task)));
        meta.appendChild(whoTag);
        if (!done) meta.appendChild(el("span", { "class": "tag tag-xp", text: "+" + C.XP_PER_TASK + " XP" }));
        body.appendChild(meta);

        if (opts.admin) body.appendChild(assignControl(task));
        li.appendChild(body);

        if (overdue) li.appendChild(el("div", { "class": "peeker peek", html: C.critter("beetle", "#48CAE4", { size: 70, grumpy: true }) }));
        return li;
    }

    function assignControl(task) {
        var wrap = el("div", { "class": "task-actions" });
        var id = "assign-" + task.id;
        wrap.appendChild(el("label", { "for": id, "class": "sr-only", text: "Assign " + task.title + " to" }));
        var select = el("select", { id: id, "class": "assign-select" });
        select.appendChild(el("option", { value: "", text: "Nobody yet" }));
        state.users.forEach(function (u) {
            var opt = el("option", { value: String(u.id), text: u.email + (u.role === "admin" ? " (admin)" : "") });
            if (u.id === task.assigned_to) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener("change", function () {
            assign(task.id, select.value ? parseInt(select.value, 10) : null);
        });
        wrap.appendChild(select);
        return wrap;
    }

    function emptyState() {
        return '<div class="empty">' +
            '<div class="night" aria-hidden="true">' +
            '<svg viewBox="0 0 60 60" width="56" height="56" style="position:absolute;top:20px;right:22px"><path d="M40 8 A24 24 0 1 0 52 44 A20 20 0 1 1 40 8 Z" fill="#FFD166" stroke="#102A43" stroke-width="3"/></svg>' +
            '<svg class="twinkle" viewBox="0 0 24 24" width="18" height="18" style="position:absolute;top:30px;left:36px"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="#FFD166"/></svg>' +
            '<svg class="twinkle" viewBox="0 0 24 24" width="14" height="14" style="position:absolute;top:80px;left:130px;animation-delay:-1.4s"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="#48CAE4"/></svg>' +
            '<div class="sway" style="position:absolute;top:60px;left:50%;width:300px;margin-left:-150px;height:216px">' +
            '<svg viewBox="0 0 360 260" width="300" height="216">' +
            '<path d="M20 0 L60 140 M340 0 L300 140" stroke="#fff" fill="none" stroke-width="3" stroke-dasharray="6 6"/>' +
            '<path class="o" d="M40 130 Q180 250 320 130 Q180 190 40 130 Z" fill="#06D6A0"/>' +
            '<g class="breathe"><circle class="o" cx="112" cy="146" r="28" fill="#EF476F"/><circle cx="102" cy="136" r="5" fill="#235789"/><circle cx="124" cy="156" r="5" fill="#235789"/><path class="o nf t" d="M98 146 Q104 150 110 146 M116 146 Q122 150 128 146"/></g>' +
            '<g class="breathe" style="animation-delay:-1s"><circle class="o" cx="180" cy="160" r="30" fill="#FFD166"/><path class="o nf t" d="M180 160 m-4 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -18 0"/><path class="o nf t" d="M164 166 Q170 170 176 166 M184 166 Q190 170 196 166"/></g>' +
            '<g class="breathe" style="animation-delay:-2s"><circle class="o" cx="248" cy="146" r="26" fill="#48CAE4"/><path class="o nf" d="M248 122 L248 170"/><path class="o nf t" d="M234 144 Q240 148 246 144 M252 144 Q258 148 264 144"/></g>' +
            "</svg></div>" +
            '<span class="z">z</span><span class="z" style="animation-delay:-1.2s">z</span><span class="z" style="animation-delay:-2.4s">Z</span>' +
            "</div>" +
            '<div class="empty-copy"><h2>All squashed! The bugs are napping.</h2>' +
            "<p>Nothing left on your list. Add a task when you're ready to wake them up.</p>" +
            '<div class="actions"><button class="btn btn-primary" type="button" data-add>Add a task</button></div></div>' +
            "</div>";
    }

    function renderTasks() {
        els.loading.classList.add("hidden");
        renderFilters();
        renderProgress();

        var open = state.tasks.filter(function (t) { return t.status !== "completed"; });
        var showEmpty = state.filter === "all" && open.length === 0;
        els.empty.classList.toggle("hidden", !showEmpty);
        if (showEmpty) {
            els.empty.innerHTML = emptyState();
            els.empty.querySelector("[data-add]").addEventListener("click", function () { openForm(null); });
        }

        var test = FILTERS.filter(function (f) { return f.id === state.filter; })[0].test;
        var shown = state.tasks.filter(test);
        taskList.innerHTML = "";
        if (!shown.length && !showEmpty) {
            taskList.appendChild(el("li", { "class": "loading", text: "Nothing here. The bugs are suspiciously quiet…" }));
        }
        shown.forEach(function (t) { taskList.appendChild(taskCard(t)); });

        if (isAdmin()) {
            els.adminSection.classList.remove("hidden");
            els.adminList.innerHTML = "";
            if (!state.allTasks.length) {
                els.adminList.appendChild(el("li", { "class": "loading", text: "No tasks in the jar yet." }));
            }
            state.allTasks.forEach(function (t) { els.adminList.appendChild(taskCard(t, { admin: true })); });
        } else {
            els.adminSection.classList.add("hidden");
        }

        if (state.detailId && els.detailDialog.open) renderDetail();
    }

    // ---------- Data ----------
    async function loadTasks() {
        try {
            state.tasks = await fetchTasks();
            if (isAdmin()) {
                var results = await Promise.all([fetchAllTasks(), fetchUsers()]);
                state.allTasks = results[0];
                state.users = results[1];
            }
            renderTasks();
        } catch (err) {
            if (handleAuthError(err)) return;
            els.loading.textContent = "Couldn't round up your bugs: " + err.message;
        }
    }

    async function squash(id) {
        var task = findTask(id);
        if (!task) return;
        var next = task.status === "completed" ? "pending" : "completed";
        if (!isMine(task) && !isAdmin() && task.assigned_to !== state.user.id) return;
        try {
            var updated = await updateTask(id, { status: next });
            replaceTask(updated);
            if (next === "completed") {
                C.recordSquash(state.user.id);
                toast("SQUASH! +" + C.XP_PER_TASK + " XP", '"' + task.title + '" is history.');
            }
            renderTasks();
        } catch (err) {
            if (handleAuthError(err)) return;
            toast("Oops!", err.message, true);
        }
    }

    async function setStatus(id, status) {
        var task = findTask(id);
        if (!task || task.status === status) return;
        try {
            var updated = await updateTask(id, { status: status });
            replaceTask(updated);
            if (status === "completed") {
                C.recordSquash(state.user.id);
                toast("SQUASH! +" + C.XP_PER_TASK + " XP", '"' + task.title + '" is history.');
            }
            renderTasks();
        } catch (err) {
            if (handleAuthError(err)) return;
            toast("Oops!", err.message, true);
        }
    }

    async function assign(id, userId) {
        try {
            var updated = await assignTask(id, userId);
            replaceTask(updated);
            await loadTasks();
            toast("Assigned!", userId ? "Sent to " + (userEmail(userId) || "a teammate") : "Nobody's on it now.");
        } catch (err) {
            if (handleAuthError(err)) return;
            toast("Oops!", err.message, true);
        }
    }

    // ---------- Add / edit form ----------
    var f = {
        title: document.getElementById("task-title"),
        desc: document.getElementById("task-description"),
        date: document.getElementById("task-date"),
        time: document.getElementById("task-time"),
        assignee: document.getElementById("task-assignee"),
        assignField: document.getElementById("assign-field"),
        count: document.getElementById("title-count"),
        titleErr: document.getElementById("title-error"),
        dateErr: document.getElementById("date-error"),
        formErr: document.getElementById("form-error"),
        submit: document.getElementById("task-submit"),
        heading: document.getElementById("task-dialog-h"),
        jar: document.getElementById("jar-line")
    };

    function pad(n) { return String(n).padStart(2, "0"); }

    function openForm(task) {
        state.editing = task ? task.id : null;
        f.heading.textContent = task ? "Tweak this task" : "Drop a task in the jar";
        f.submit.textContent = task ? "Save changes" : "Plop it in!";
        f.title.value = task ? task.title : "";
        f.desc.value = task && task.description ? task.description : "";
        var due = task ? new Date(task.due_date) : new Date(Date.now() + 24 * 3600 * 1000);
        f.date.value = due.getFullYear() + "-" + pad(due.getMonth() + 1) + "-" + pad(due.getDate());
        f.time.value = task ? pad(due.getHours()) + ":" + pad(due.getMinutes()) : "09:00";
        f.count.textContent = f.title.value.length + " / 200";
        [f.titleErr, f.dateErr, f.formErr].forEach(function (e) { e.textContent = ""; });
        [f.title, f.date, f.time].forEach(function (i) { i.removeAttribute("aria-invalid"); });
        f.jar.textContent = "feed us!";

        var showAssign = isAdmin() && !task;
        f.assignField.classList.toggle("hidden", !showAssign);
        if (showAssign) {
            f.assignee.innerHTML = "";
            f.assignee.appendChild(el("option", { value: "", text: "Nobody yet" }));
            state.users.forEach(function (u) {
                f.assignee.appendChild(el("option", { value: String(u.id), text: u.id === state.user.id ? "Me, obviously" : u.email }));
            });
        }

        if (els.detailDialog.open) els.detailDialog.close();
        els.taskDialog.showModal();
        f.title.focus();
    }

    function validate() {
        var ok = true;
        f.titleErr.textContent = "";
        f.dateErr.textContent = "";
        f.title.removeAttribute("aria-invalid");
        f.date.removeAttribute("aria-invalid");
        f.time.removeAttribute("aria-invalid");

        if (!f.title.value.trim()) {
            f.titleErr.textContent = "Your task needs a name. Even bugs have names.";
            f.title.setAttribute("aria-invalid", "true");
            ok = false;
        }
        var when = new Date(f.date.value + "T" + (f.time.value || "00:00"));
        if (!f.date.value || !f.time.value || isNaN(when.getTime())) {
            f.dateErr.textContent = "Pick a due date and time so the bugs know when to panic.";
            ok = false;
        } else if (when.getTime() <= Date.now()) {
            f.dateErr.textContent = "That's in the past! Bugs can't time travel. Pick a future date and time.";
            ok = false;
        }
        if (f.dateErr.textContent) {
            f.date.setAttribute("aria-invalid", "true");
            f.time.setAttribute("aria-invalid", "true");
        }
        [f.titleErr, f.dateErr].forEach(function (e) {
            e.classList.remove("pop");
            if (e.textContent) { void e.offsetWidth; e.classList.add("pop"); }
        });
        f.jar.textContent = ok ? "nom nom nom" : "hmm, something's off";
        return ok ? when : null;
    }

    f.title.addEventListener("input", function () { f.count.textContent = f.title.value.length + " / 200"; });

    els.taskForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        var when = validate();
        if (!when) {
            els.taskForm.classList.remove("shake");
            void els.taskForm.offsetWidth;
            els.taskForm.classList.add("shake");
            var bad = els.taskForm.querySelector('[aria-invalid="true"]');
            if (bad) bad.focus();
            return;
        }
        f.formErr.textContent = "";
        f.submit.disabled = true;
        try {
            var title = f.title.value.trim();
            var description = f.desc.value.trim() || null;
            if (state.editing) {
                await updateTask(state.editing, { title: title, description: description, due_date: when.toISOString() });
                toast("Saved!", '"' + title + '" got a makeover.');
            } else {
                var created = await createTask(title, description, when);
                if (f.assignee.value && isAdmin()) await assignTask(created.id, parseInt(f.assignee.value, 10));
                toast("Plop!", '"' + title + '" is in the jar.');
            }
            els.taskDialog.close();
            await loadTasks();
        } catch (err) {
            if (handleAuthError(err)) return;
            f.formErr.textContent = err.message;
        } finally {
            f.submit.disabled = false;
        }
    });

    // ---------- Detail ----------
    function openDetail(id) {
        state.detailId = id;
        renderDetail();
        if (!els.detailDialog.open) els.detailDialog.showModal();
    }

    function renderDetail(confirming) {
        var task = findTask(state.detailId);
        if (!task) {
            if (els.detailDialog.open) els.detailDialog.close();
            return;
        }
        var d = els.detail;
        var done = task.status === "completed";
        var statusDef = STATUS.filter(function (s) { return s.id === task.status; })[0] || STATUS[0];
        var canChangeStatus = canEdit(task) || task.assigned_to === state.user.id;
        d.innerHTML = "";
        if (done) d.insertAdjacentHTML("beforeend", C.confetti(22));

        var head = el("div", { "class": "sheet-head" });
        var titles = el("div", { style: "display:flex;flex-direction:column;gap:10px;min-width:0" });
        var pills = el("div", { "class": "meta" });
        pills.appendChild(el("span", { "class": "pill pill-" + task.status, text: statusDef.label }));
        if (!done) pills.appendChild(el("span", { "class": "tag tag-xp", text: "+" + C.XP_PER_TASK + " XP when squashed" }));
        titles.appendChild(pills);
        titles.appendChild(el("h2", { "class": "detail-title", id: "detail-title", text: task.title }));
        head.appendChild(titles);
        head.appendChild(el("button", { type: "button", "class": "icon-btn", "aria-label": "Close", html: ICONS.close, onclick: function () { els.detailDialog.close(); } }));
        d.appendChild(head);

        var stepper = el("div", { "class": "stepper", role: "radiogroup", "aria-label": "Task status" });
        STATUS.forEach(function (s, i) {
            var b = el("button", {
                type: "button", "class": "step", role: "radio", "data-status": s.id,
                "aria-checked": String(task.status === s.id),
                onclick: function () { setStatus(task.id, s.id); }
            });
            if (!canChangeStatus) b.disabled = true;
            b.appendChild(el("span", { "class": "step-num", text: String(i + 1) }));
            b.appendChild(el("span", { text: s.label }));
            stepper.appendChild(b);
        });
        d.appendChild(stepper);

        var facts = el("dl", { "class": "facts" });
        function fact(label, value) {
            var box = el("div", { "class": "fact" });
            box.appendChild(el("dt", { text: label }));
            box.appendChild(el("dd", { text: value }));
            facts.appendChild(box);
        }
        fact("Due", C.isOverdue(task) ? overdueBy(new Date(task.due_date)) : formatWhen(new Date(task.due_date)));
        fact("Who's on it", whoLabel(task));
        fact("Reminder", "Email about a day before");
        d.appendChild(facts);

        var juicy = el("section", { "class": "juicy", "aria-labelledby": "juicy-h" });
        var jh = el("h3", { id: "juicy-h" });
        jh.appendChild(el("span", { "class": "juicy-icon", html: ICONS.notepad }));
        jh.appendChild(document.createTextNode("The juicy details"));
        juicy.appendChild(jh);
        juicy.appendChild(el("p", { text: task.description || "No details. Very mysterious." }));
        d.appendChild(juicy);

        if (canEdit(task)) {
            var actions = el("div", { "class": "detail-actions" });
            if (confirming) {
                var box = el("div", { "class": "confirm", role: "alert" });
                box.appendChild(el("span", { text: "Delete this task forever? Even the bugs can't bring it back." }));
                box.appendChild(el("button", { type: "button", "class": "btn btn-small", text: "Keep it", onclick: function () { renderDetail(false); } }));
                box.appendChild(el("button", {
                    type: "button", "class": "btn btn-small btn-danger-solid", text: "Yes, delete",
                    onclick: async function () {
                        try {
                            await deleteTask(task.id);
                            els.detailDialog.close();
                            toast("Squished forever.", '"' + task.title + '" is gone.');
                            await loadTasks();
                        } catch (err) {
                            if (handleAuthError(err)) return;
                            toast("Oops!", err.message, true);
                        }
                    }
                }));
                actions.appendChild(box);
            } else {
                var edit = el("button", { type: "button", "class": "btn btn-small", html: ICONS.pencil, onclick: function () { openForm(task); } });
                edit.appendChild(document.createTextNode("Edit"));
                var del = el("button", { type: "button", "class": "btn btn-small btn-danger", html: ICONS.trash, onclick: function () { renderDetail(true); } });
                del.appendChild(document.createTextNode("Delete"));
                actions.appendChild(edit);
                actions.appendChild(del);
                if (isAdmin()) actions.appendChild(assignControl(task));
            }
            d.appendChild(actions);
        }
    }

    // ---------- Wiring ----------
    document.getElementById("add-task-btn").addEventListener("click", function () { openForm(null); });
    document.getElementById("fab").addEventListener("click", function () { openForm(null); });
    document.querySelectorAll("[data-close]").forEach(function (b) {
        b.addEventListener("click", function () { b.closest("dialog").close(); });
    });
    [els.taskDialog, els.detailDialog].forEach(function (dlg) {
        // Click on the dimmed backdrop closes the sheet
        dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    });
    els.detailDialog.addEventListener("close", function () { state.detailId = null; });

    // ---------- Boot ----------
    fetchCurrentUser()
        .then(function (user) {
            state.user = user;
            state.buddy = C.loadBuddy(user.id);
            if (!state.buddy) {
                window.location.href = "onboarding.html";
                return;
            }
            document.getElementById("user-email").textContent = user.email;
            document.getElementById("user-role").textContent = user.role === "admin" ? "Admin · Chief Bug Boss" : "Bug wrangler";
            document.getElementById("avatar").textContent = user.email.charAt(0);
            return loadTasks();
        })
        .catch(function (err) {
            if (handleAuthError(err)) return;
            els.loading.textContent = "Couldn't reach the bug server: " + err.message;
        });
})();
