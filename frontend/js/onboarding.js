(function () {
    if (!localStorage.getItem("token")) {
        window.location.href = "login.html";
        return;
    }

    var C = window.Critters;
    var NAMES = ["Sir Wiggles", "Captain Crumb", "Noodle", "Beans McGee"];
    var BUBBLES = ["", "hi!! hi!! HI!!", "is that... me?", "feed me tasks pls", "LET'S GOOO!"];
    var ANIMS = ["", "pop", "bob", "jiggle", "dance"];

    var state = { step: 0, name: NAMES[0], species: "ladybug", color: C.COLORS[0].hex };
    var user = null;
    var startingXp = 0;

    var sections = document.querySelectorAll("section[data-step]");
    var dots = document.getElementById("dots");
    var stageCenter = document.getElementById("stage-center");
    var stageConfetti = document.getElementById("stage-confetti");
    var nameInput = document.getElementById("buddy-name");
    var nameError = document.getElementById("name-error");

    document.getElementById("brand-bug").innerHTML = C.critter("ladybug", "#EF476F", { size: 44 });
    document.getElementById("hill").innerHTML = C.hill();
    document.getElementById("ground").innerHTML = C.ground();

    function stageHtml() {
        if (state.step === 0) {
            return '<div style="position: relative;"><div class="wobble">' + C.egg(200) + "</div>" +
                '<div class="bubble bubble-yellow bob" style="position: absolute; top: -30px; right: -70px;">tap tap?</div></div>';
        }
        var html = '<div class="bubble pop">' + BUBBLES[state.step] + "</div>" +
            '<div class="' + ANIMS[state.step] + '">' +
            C.critter(state.species, state.color, { size: 200, label: "Your buddy, " + state.name }) + "</div>" +
            '<div class="name-tag"></div>';
        if (state.step === 1) {
            html += '<div style="margin-top: -60px;">' + C.shell(210) + "</div>";
        }
        return html;
    }

    function render() {
        sections.forEach(function (s) { s.hidden = Number(s.dataset.step) !== state.step; });
        Array.prototype.forEach.call(dots.children, function (d, i) {
            d.className = i < state.step ? "done" : (i === state.step ? "current" : "");
        });
        dots.setAttribute("aria-valuenow", state.step + 1);

        stageCenter.innerHTML = stageHtml();
        var tag = stageCenter.querySelector(".name-tag");
        if (tag) tag.textContent = state.name;
        stageConfetti.innerHTML = state.step === 4 ? C.confetti(26) : "";

        document.querySelectorAll("[data-name]").forEach(function (el) { el.textContent = state.name; });

        document.querySelectorAll("#name-chips .chip").forEach(function (chip) {
            chip.setAttribute("aria-pressed", String(chip.textContent === state.name));
        });
        document.querySelectorAll("#species .species-btn").forEach(function (btn) {
            btn.setAttribute("aria-pressed", String(btn.dataset.species === state.species));
            btn.querySelector(".mini").innerHTML = C.critter(btn.dataset.species, state.color, { size: 54 });
        });
        document.querySelectorAll("#swatches .swatch").forEach(function (sw) {
            sw.setAttribute("aria-pressed", String(sw.dataset.color === state.color));
        });
        var colour = C.COLORS.filter(function (c) { return c.hex === state.color; })[0];
        document.getElementById("color-label").textContent = colour ? colour.label : "";

        var p = { level: Math.floor(startingXp / 100) + 1 };
        document.getElementById("ready-title").textContent = "Level " + p.level + " unlocked: " + C.levelName(p.level);
        document.getElementById("ready-xp").textContent = startingXp + " / " + p.level * 100 + " XP";
        document.getElementById("ready-meter").style.width = (startingXp % 100) + "%";
    }

    function go(step) {
        if (state.step === 1 && step > 1) {
            var name = nameInput.value.trim();
            if (!name) {
                nameError.textContent = "Your buddy needs a name. Even bugs have names.";
                nameInput.setAttribute("aria-invalid", "true");
                nameInput.focus();
                return;
            }
            state.name = name;
        }
        nameError.textContent = "";
        nameInput.removeAttribute("aria-invalid");
        state.step = Math.max(0, Math.min(4, step));
        render();
        var heading = document.querySelector('section[data-step="' + state.step + '"] h1');
        if (heading) {
            heading.setAttribute("tabindex", "-1");
            heading.focus({ preventScroll: true });
        }
    }

    // Build the pickers once
    var chips = document.getElementById("name-chips");
    NAMES.forEach(function (n) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = n;
        b.addEventListener("click", function () {
            state.name = n;
            nameInput.value = n;
            render();
        });
        chips.appendChild(b);
    });

    var speciesEl = document.getElementById("species");
    C.SPECIES.forEach(function (sp) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "species-btn";
        b.dataset.species = sp.id;
        b.innerHTML = '<span class="mini"></span><span></span>';
        b.lastChild.textContent = sp.label;
        b.addEventListener("click", function () {
            state.species = sp.id;
            render();
        });
        speciesEl.appendChild(b);
    });

    var swatches = document.getElementById("swatches");
    C.COLORS.forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "swatch";
        b.dataset.color = c.hex;
        b.style.background = c.hex;
        b.setAttribute("aria-label", c.label);
        b.addEventListener("click", function () {
            state.color = c.hex;
            render();
        });
        swatches.appendChild(b);
    });

    nameInput.addEventListener("input", function () {
        state.name = nameInput.value.trim() || state.name;
        var tag = stageCenter.querySelector(".name-tag");
        if (tag) tag.textContent = nameInput.value.trim();
        document.querySelectorAll("#name-chips .chip").forEach(function (chip) {
            chip.setAttribute("aria-pressed", String(chip.textContent === nameInput.value.trim()));
        });
    });
    nameInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") go(2);
    });

    document.querySelectorAll("[data-next]").forEach(function (b) {
        b.addEventListener("click", function () { go(state.step + 1); });
    });
    document.querySelectorAll("[data-back]").forEach(function (b) {
        b.addEventListener("click", function () { go(state.step - 1); });
    });
    stageCenter.addEventListener("click", function () {
        if (state.step === 0) go(1);
    });

    document.getElementById("finish-btn").addEventListener("click", function () {
        if (user) C.saveBuddy(user.id, { name: state.name, species: state.species, color: state.color });
        window.location.href = "dashboard.html";
    });

    // Skipping still hands out a default buddy so the dashboard has someone to show.
    document.getElementById("skip-link").addEventListener("click", function () {
        if (user && !C.loadBuddy(user.id)) {
            C.saveBuddy(user.id, { name: NAMES[0], species: "ladybug", color: C.COLORS[0].hex });
        }
    });

    nameInput.value = state.name;
    render();

    fetchCurrentUser()
        .then(function (u) {
            user = u;
            var existing = C.loadBuddy(u.id);
            if (existing) {
                state.name = existing.name;
                state.species = existing.species;
                state.color = existing.color;
                nameInput.value = existing.name;
            }
            return fetchTasks().then(function (tasks) {
                startingXp = C.progress(tasks).xp;
            }).catch(function () { /* XP preview is optional */ });
        })
        .then(render)
        .catch(function (err) {
            if (err && err.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
            }
        });
})();
