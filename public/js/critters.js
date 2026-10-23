// Bug buddies: SVG drawings, the user's buddy, XP/levels and streaks.
// Buddy and streak live in this browser only (the API has no fields for them).
(function () {
    var COLORS = [
        { hex: "#EF476F", label: "Cherry red" },
        { hex: "#FFD166", label: "Banana yellow" },
        { hex: "#06D6A0", label: "Minty green" },
        { hex: "#48CAE4", label: "Sky blue" }
    ];
    var SPECIES = [
        { id: "ladybug", label: "Ladybug" },
        { id: "snail", label: "Snail" },
        { id: "beetle", label: "Beetle" },
        { id: "caterpillar", label: "Wiggler" }
    ];
    var LEVEL_NAMES = [
        "Tiny Bug Wrangler", "Ant Whisperer", "Beetle Boss", "Snail Sprinter",
        "Caterpillar Commander", "Ladybug Legend", "Grand Garden Guardian"
    ];
    var XP_PER_TASK = 20;
    var XP_PER_LEVEL = 100;

    var EYES_BIG = '<g class="blink"><circle cx="43" cy="24" r="6" fill="#fff"/><circle cx="57" cy="24" r="6" fill="#fff"/>' +
        '<circle cx="44" cy="25" r="3" fill="#102A43"/><circle cx="58" cy="25" r="3" fill="#102A43"/></g>';

    var BODIES = {
        ladybug: function (c) {
            return '<path class="o nf" d="M24 52 L10 44 M22 68 L8 72 M76 52 L90 44 M78 68 L92 72 M44 16 Q40 6 32 6 M56 16 Q60 6 68 6"/>' +
                '<circle cx="32" cy="6" r="4" fill="#235789"/><circle cx="68" cy="6" r="4" fill="#235789"/>' +
                '<circle cx="50" cy="30" r="16" fill="#235789"/><circle class="o" cx="50" cy="62" r="30" fill="' + c + '"/>' +
                '<path class="o nf" d="M50 36 L50 91"/><circle cx="37" cy="54" r="5" fill="#235789"/><circle cx="63" cy="54" r="5" fill="#235789"/>' +
                '<circle cx="38" cy="74" r="5" fill="#235789"/><circle cx="62" cy="74" r="5" fill="#235789"/>' + EYES_BIG;
        },
        snail: function (c) {
            return '<rect class="o" x="6" y="70" width="88" height="20" rx="10" fill="#06D6A0"/>' +
                '<rect class="o" x="10" y="40" width="22" height="46" rx="11" fill="#06D6A0"/>' +
                '<path class="o nf" d="M16 42 L10 24 M26 42 L32 24"/><circle class="o" cx="62" cy="52" r="26" fill="' + c + '"/>' +
                '<path class="o nf t" d="M62 52 m-4 0 a4 4 0 1 1 8 0 a8 8 0 1 1 -16 0 a12 12 0 1 1 24 0 a16 16 0 1 1 -32 0"/>' +
                '<path class="o nf t" d="M15 60 Q21 65 27 60"/>' +
                '<g class="blink"><circle class="o t" cx="10" cy="20" r="7" fill="#fff"/><circle class="o t" cx="32" cy="20" r="7" fill="#fff"/>' +
                '<circle cx="11" cy="21" r="3" fill="#102A43"/><circle cx="33" cy="21" r="3" fill="#102A43"/></g>';
        },
        beetle: function (c) {
            return '<path class="o nf" d="M26 50 L10 40 M24 66 L8 70 M26 82 L14 92 M74 50 L90 40 M76 66 L92 70 M74 82 L86 92 M50 14 Q50 2 60 4"/>' +
                '<circle cx="50" cy="26" r="14" fill="#235789"/><ellipse class="o" cx="50" cy="62" rx="28" ry="30" fill="' + c + '"/>' +
                '<path class="o nf" d="M50 34 L50 91"/><path fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" d="M32 52 Q33 44 40 40"/>' +
                '<g class="blink"><circle cx="44" cy="23" r="5" fill="#fff"/><circle cx="56" cy="23" r="5" fill="#fff"/>' +
                '<circle cx="45" cy="24" r="2.5" fill="#102A43"/><circle cx="57" cy="24" r="2.5" fill="#102A43"/></g>';
        },
        caterpillar: function (c) {
            return '<path class="o nf t" d="M84 78 L84 86 M64 74 L64 82 M44 78 L44 86 M18 36 Q14 24 8 24 M32 36 Q36 24 42 24"/>' +
                '<circle cx="8" cy="24" r="4" fill="#235789"/><circle cx="42" cy="24" r="4" fill="#235789"/>' +
                '<circle class="o" cx="84" cy="66" r="12" fill="' + c + '"/><circle class="o" cx="64" cy="62" r="13" fill="' + c + '"/>' +
                '<circle class="o" cx="44" cy="66" r="13" fill="' + c + '"/><circle class="o" cx="25" cy="52" r="18" fill="' + c + '"/>' +
                '<path class="o nf t" d="M19 60 Q25 65 31 60"/>' +
                '<g class="blink"><circle class="o t" cx="19" cy="47" r="5" fill="#fff"/><circle class="o t" cx="32" cy="47" r="5" fill="#fff"/>' +
                '<circle cx="20" cy="48" r="2.5" fill="#102A43"/><circle cx="33" cy="48" r="2.5" fill="#102A43"/></g>';
        }
    };
    var BROWS = {
        ladybug: "M37 15 L47 19 M63 15 L53 19",
        snail: "M3 9 L14 13 M39 9 L28 13",
        beetle: "M38 14 L47 19 M62 14 L53 19",
        caterpillar: "M13 38 L22 42 M38 38 L29 42"
    };

    function safeColor(hex) {
        return COLORS.some(function (c) { return c.hex === hex; }) ? hex : COLORS[0].hex;
    }

    function critter(species, color, opts) {
        opts = opts || {};
        var draw = BODIES[species] || BODIES.ladybug;
        var size = opts.size || 100;
        var label = opts.label ? ' role="img" aria-label="' + opts.label + '"' : ' aria-hidden="true"';
        var brows = opts.grumpy ? '<path d="' + (BROWS[species] || BROWS.ladybug) + '" stroke="#FFD166" stroke-width="3.5" stroke-linecap="round"/>' : "";
        return '<svg class="critter ' + (opts.cls || "") + '" viewBox="0 0 100 100" width="' + size + '" height="' + size + '"' + label + '>' +
            draw(safeColor(color)) + brows + "</svg>";
    }

    function ant() {
        return '<g transform="translate(-30 -31)"><g opacity=".5"><path class="o t nf leg b" d="M27 20 L25 31"/><path class="o t nf leg a" d="M31 20 L31 31"/>' +
            '<path class="o t nf leg b" d="M35 20 L37 31"/></g><path class="o t nf leg a" d="M26 21 L24 31"/><path class="o t nf leg b" d="M30 21 L30 31"/>' +
            '<path class="o t nf leg a" d="M34 21 L36 31"/><g class="tb"><ellipse cx="14" cy="17" rx="10" ry="7.5" fill="#235789"/>' +
            '<ellipse cx="29" cy="18" rx="6" ry="4.5" fill="#235789"/><circle cx="43" cy="15" r="7" fill="#235789"/><path class="o t nf" d="M45 9 Q49 2 55 4"/>' +
            '<circle cx="46" cy="13" r="2.6" fill="#fff"/><circle cx="47" cy="13" r="1.3" fill="#102A43"/></g></g>';
    }

    var WAVE = "M0 90 Q120 50 240 84 T480 80 T720 86 T960 76 T1200 86 T1440 74";
    var WALK = "M-80 100 L0 90 Q120 50 240 84 T480 80 T720 86 T960 76 T1200 86 T1440 74 L1520 66";

    // Wavy grass along the page bottom, with two ants walking on it.
    function ground() {
        var ants = [["38s", "0s"], ["44s", "-21s"]].map(function (a) {
            return '<g class="ant"><animateMotion dur="' + a[0] + '" begin="' + a[1] + '" repeatCount="indefinite" rotate="auto" path="' + WALK + '"/>' + ant() + "</g>";
        }).join("");
        return '<svg class="ground" viewBox="0 0 1440 160" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
            '<path class="ground-fill" d="' + WAVE + ' L1440 160 L0 160 Z"/><path class="o nf" d="' + WAVE + '"/>' + ants + "</svg>";
    }

    function hill() {
        return '<svg class="hill" viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true">' +
            '<path d="M0 70 Q300 -10 600 70 L600 160 L0 160 Z" fill="#06D6A0"/><path class="o nf" d="M0 70 Q300 -10 600 70"/></svg>';
    }

    function egg(size) {
        return '<svg viewBox="0 0 120 140" width="' + size + '" height="' + Math.round(size * 1.16) + '" role="img" aria-label="A spotty egg, wobbling">' +
            '<ellipse class="o" cx="60" cy="72" rx="44" ry="56" fill="#fff"/><circle cx="42" cy="56" r="9" fill="#48CAE4"/>' +
            '<circle cx="76" cy="42" r="6" fill="#FFD166"/><circle cx="80" cy="88" r="10" fill="#EF476F"/><circle cx="40" cy="98" r="6" fill="#06D6A0"/>' +
            '<path class="o nf t" d="M36 36 L46 46 L54 36 L62 48 L72 38"/></svg>';
    }

    function shell(size) {
        return '<svg viewBox="0 0 120 70" width="' + size + '" height="' + Math.round(size * 0.58) + '" aria-hidden="true">' +
            '<path class="o" d="M10 14 L22 4 L32 16 L44 4 L56 16 L68 4 L80 16 L92 4 L110 14 Q110 64 60 64 Q10 64 10 14 Z" fill="#fff"/>' +
            '<circle cx="34" cy="38" r="7" fill="#48CAE4"/><circle cx="82" cy="40" r="8" fill="#EF476F"/></svg>';
    }

    function confetti(count) {
        var palette = ["#48CAE4", "#FFD166", "#06D6A0", "#EF476F"];
        var html = "";
        for (var i = 0; i < count; i++) {
            html += '<span style="left:' + ((i * 37) % 100) + "%;width:" + (i % 2 ? 10 : 14) + "px;height:" + (i % 3 ? 16 : 10) +
                "px;background:" + palette[i % 4] + ";animation-delay:-" + ((i * 0.31) % 3.4).toFixed(2) + "s;animation-duration:" +
                (3 + (i % 5) * 0.5).toFixed(1) + 's"></span>';
        }
        return '<div class="confetti" aria-hidden="true">' + html + "</div>";
    }

    // ---------- Per-user storage ----------
    function readJson(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }
    function writeJson(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked: buddy just isn't remembered */ }
    }

    function loadBuddy(userId) {
        var b = readJson("tasktion.buddy." + userId, null);
        if (!b || !b.name) return null;
        return {
            name: String(b.name).slice(0, 20),
            species: BODIES[b.species] ? b.species : "ladybug",
            color: safeColor(b.color)
        };
    }
    function saveBuddy(userId, buddy) {
        writeJson("tasktion.buddy." + userId, buddy);
    }

    function dayKey(d) {
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function recordSquash(userId) {
        var key = "tasktion.squashDays." + userId;
        var days = readJson(key, []);
        var today = dayKey(new Date());
        if (days.indexOf(today) === -1) days.push(today);
        writeJson(key, days.slice(-60));
    }
    // Consecutive days with a squash, ending today (or yesterday, so the streak survives until tonight).
    function streak(userId) {
        var days = readJson("tasktion.squashDays." + userId, []);
        var d = new Date();
        if (days.indexOf(dayKey(d)) === -1) d.setDate(d.getDate() - 1);
        var n = 0;
        while (days.indexOf(dayKey(d)) !== -1) {
            n++;
            d.setDate(d.getDate() - 1);
        }
        return n;
    }

    function isOverdue(task) {
        return task.status !== "completed" && new Date(task.due_date) < new Date();
    }

    function progress(tasks) {
        var completed = tasks.filter(function (t) { return t.status === "completed"; }).length;
        var xp = completed * XP_PER_TASK;
        var level = Math.floor(xp / XP_PER_LEVEL) + 1;
        return {
            completed: completed,
            overdue: tasks.filter(isOverdue).length,
            xp: xp,
            level: level,
            levelName: LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1],
            nextAt: level * XP_PER_LEVEL,
            pct: Math.round(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100)
        };
    }

    window.Critters = {
        COLORS: COLORS,
        SPECIES: SPECIES,
        XP_PER_TASK: XP_PER_TASK,
        critter: critter,
        ground: ground,
        hill: hill,
        egg: egg,
        shell: shell,
        confetti: confetti,
        loadBuddy: loadBuddy,
        saveBuddy: saveBuddy,
        recordSquash: recordSquash,
        streak: streak,
        isOverdue: isOverdue,
        progress: progress,
        levelName: function (level) { return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1]; }
    };
})();
