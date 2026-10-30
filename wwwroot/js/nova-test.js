/*
 * AvtoPrava Nova — yagona test dvigateli (barcha test turlari).
 *
 * Sozlamalar: window.NOVA_TEST (Views/Shared/_NovaTest.cshtml).
 * Qoidalar eski versiya bilan bir xil:
 *   - variantlar har bir savolda aralashtiriladi (qayta ishlashda boshqa tartib), F1..F5 bilan javob berish;
 *   - javob berilgach 0,5 soniyadan keyin keyingi savolga o'tiladi, hammasiga javob berilsa test yakunlanadi;
 *   - o'tish balli — savollarning 90% i (real imtihonda — 18 ta to'g'ri);
 *   - real imtihon: javobni tasdiqlash (Ha / Yo'q), 25 daqiqa, 3-xatoda imtihon to'xtaydi;
 *   - "Ko'rib chiqish", "Xatolarni ishlash", "Qayta ishlash".
 * Natija kabinetga yoziladi (/Cabinet/SaveResult) — har bir javobga ketgan vaqt bilan birga.
 */
(function () {
    "use strict";

    var cfg = window.NOVA_TEST || {};
    var EXAM_SECONDS = 25 * 60;
    var LOGO = "/images/logo.png?w=480";
    var MAX_WRONG = 2;

    var originalQuestions = [];
    var questions = [];
    var currentIndex = 0;
    var answers = {};
    var shuffledOrders = {};
    var isReviewMode = false;
    var incorrectQuestionsGlobal = [];
    var lastResult = null;

    var examMode = !!cfg.exam;
    var examOver = false;
    var endReason = null;
    var pendingAnswer = null;

    // Urinish: har bir yangi to'plam (boshlash, qayta ishlash, xatolarni ishlash) — alohida natija
    var round = null;
    var times = {};        // savol id → javobgacha ketgan vaqt (ms)
    var shownAt = 0;       // joriy savol ko'rsatilgan lahza
    var shownId = null;

    var $ = function (id) { return document.getElementById(id); };
    var t = function (k, a) { return window.I18n ? I18n.t(k, a) : k; };

    function newKey() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }

    function startRound(fromErrors) {
        flushTime();
        round = { key: newKey(), startedAt: Date.now(), fromErrors: !!fromErrors };
        times = {};
        shownId = null;
    }

    function clone(x) { return JSON.parse(JSON.stringify(x)); }
    function limited(list) { return cfg.limit ? list.slice(0, cfg.limit) : list; }

    function shuffleArray(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
    }

    function getQuestionText(q) { return I18n.pick(q.questionUZ, q.questionRU, q.questionUZK); }
    function getOptionText(o) { return I18n.pick(o.textUZ, o.textRU, o.textUZK); }
    function isAnswered(q) { return answers[q.id] !== undefined; }
    function selectedOf(q) { return q.options.find(function (o) { return o.id == answers[q.id]; }); }
    function isCorrect(q) { var s = selectedOf(q); return !!(s && s.isCorrect); }

    function getShuffledOptions(q) {
        if ((isAnswered(q) || isReviewMode) && shuffledOrders[q.id]) {
            return shuffledOrders[q.id].map(function (i) { return q.options[i]; });
        }
        var prev = shuffledOrders[q.id] ? shuffledOrders[q.id].slice() : null;
        var indices, attempts = 0;
        do {
            indices = shuffleArray(q.options.map(function (_, i) { return i; }));
            attempts++;
            if (attempts > 20) break;
        } while (prev && JSON.stringify(indices) === JSON.stringify(prev));
        shuffledOrders[q.id] = indices;
        return indices.map(function (i) { return q.options[i]; });
    }

    // ───────────── Javob vaqti ─────────────

    function flushTime() {
        if (shownId !== null && shownAt) {
            times[shownId] = (times[shownId] || 0) + (Date.now() - shownAt);
        }
        shownId = null;
        shownAt = 0;
    }

    function trackShown(q) {
        flushTime();
        if (!q || isAnswered(q) || isReviewMode || examOver) return;
        shownId = q.id;
        shownAt = Date.now();
    }

    document.addEventListener("visibilitychange", function () {
        // Tab yashirilganda vaqt sanalmaydi
        if (document.visibilityState === "hidden") { var id = shownId; flushTime(); shownId = id; shownAt = 0; }
        else if (shownId !== null) shownAt = Date.now();
    });

    // ───────────── Yuklash ─────────────

    function showError(msg) {
        var box = $("errorBox");
        box.hidden = false;
        box.textContent = msg;
    }

    function topicName() {
        var n = cfg.topicNames;
        return n ? I18n.pick(n.uz, n.ru, n.uzk) : "";
    }

    async function loadQuestions() {
        var res = await fetch(cfg.source, { headers: { Accept: "application/json" }, credentials: "same-origin" });
        var text = await res.text();
        if (!res.ok) throw new Error(t("test.serverError", { status: res.status }) + (text ? "\n\n" + text : ""));
        var data;
        try { data = JSON.parse(text); } catch (e) { throw new Error(t("test.badJson")); }

        var list;
        if (cfg.format === "bilet") {
            if (data && data.success === false) throw new Error(data.message || t("bilet.loadError"));
            list = (data && data.questions) || [];
        } else if (Array.isArray(data)) {
            list = data;
        } else {
            if (data && data.error) throw new Error(data.message || t("test.controllerError"));
            throw new Error(t("test.badData"));
        }

        originalQuestions = clone(list);
        questions = limited(clone(list));

        if (!questions.length) {
            $("questionText").textContent = cfg.topicNames ? t("topics.noQuestions") : t("test.noQuestions");
            if (cfg.format === "bilet") showError(t("bilet.noQuestions"));
            else if (cfg.topicNames) showError(t("topics.topic") + ": " + topicName() + "\n\n" + t("topics.noQuestionsDb"));
            return;
        }
        createNavigation();
    }

    // ───────────── Chizish ─────────────

    function renderQuestion() {
        if (!questions.length) return;
        var q = questions[currentIndex];
        if (!q) return;

        $("questionText").textContent = getQuestionText(q);
        $("ntQnum").textContent = t("test.qOf", { n: currentIndex + 1, total: questions.length });
        $("ntQtag").textContent = "#" + q.id;

        // Rasm; savolda rasm bo'lmasa — logotip
        var box = $("ntImgBox"), img = $("questionImage");
        box.hidden = false;
        box.classList.toggle("logo", !q.imageUrl);
        img.src = q.imageUrl ? "/uploads/" + q.imageUrl : LOGO;

        var container = $("optionsContainer");
        container.innerHTML = "";
        if (!q.options || !q.options.length) {
            container.innerHTML = '<div class="nt-error"></div>';
            container.firstChild.textContent = t("test.noOptions");
            updateAll();
            return;
        }

        var shuffled = getShuffledOptions(q);
        var alreadyAnswered = isAnswered(q) || isReviewMode;

        shuffled.forEach(function (o, index) {
            var div = document.createElement("div");
            div.className = "option-row" + (alreadyAnswered ? " answered" : "");
            div.setAttribute("role", "listitem");

            var btn = document.createElement("div");
            btn.className = "option-btn";
            btn.textContent = "F" + (index + 1);

            var textDiv = document.createElement("div");
            textDiv.className = "option-text";
            textDiv.textContent = getOptionText(o);

            div.appendChild(btn);
            div.appendChild(textDiv);

            if (alreadyAnswered) {
                var selectedId = answers[q.id];
                if (selectedId !== undefined) {
                    var selected = q.options.find(function (opt) { return opt.id == selectedId; });
                    if (selected) {
                        if (selected.isCorrect) {
                            if (o.id === selected.id) div.classList.add("correct");
                        } else {
                            if (o.id === selected.id) div.classList.add("incorrect");
                            if (o.isCorrect) div.classList.add("correct");
                        }
                    }
                } else if (o.isCorrect) {
                    div.classList.add("correct");
                }
            } else {
                div.tabIndex = 0;
                div.onclick = function () { choose(q, o, index); };
                div.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(q, o, index); } };
            }
            container.appendChild(div);
        });

        // Izoh (bazada bo'lsa) — javobdan keyin
        var ex = I18n.pick(q.explanationUZ, q.explanationRU, q.explanationUZK);
        var exBox = $("ntExplain");
        exBox.hidden = !(alreadyAnswered && ex);
        if (ex) exBox.querySelector("span").textContent = ex;

        var card = $("ntCard");
        card.style.animation = "none";
        void card.offsetWidth;
        card.style.animation = "";

        trackShown(q);
        updateAll();
        preload();
    }

    function choose(q, o, index) {
        if (examMode) askConfirm(q, o, index);
        else selectAnswer(q, o);
    }

    function selectAnswer(q, o) {
        if (isAnswered(q) || isReviewMode || examOver) return;
        if (shownId === q.id) flushTime();
        answers[q.id] = o.id;
        renderQuestion();
        // Real imtihon: 3-xato — imtihon shu zahoti to'xtaydi
        if (examMode && wrongCount() > MAX_WRONG) { endExam("mistakes"); return; }
        checkAutoFinish();
        setTimeout(function () {
            if (currentIndex < questions.length - 1 && !isReviewMode && !examOver && $("resultCard").hidden) {
                currentIndex++;
                renderQuestion();
            }
        }, 500);
    }

    function wrongCount() {
        return questions.filter(function (q) { return isAnswered(q) && !isCorrect(q); }).length;
    }

    function createNavigation() {
        var nav = $("questionNav");
        nav.innerHTML = "";
        questions.forEach(function (q, i) {
            var b = document.createElement("button");
            b.type = "button";
            b.textContent = i + 1;
            b.onclick = function () { currentIndex = i; renderQuestion(); };
            nav.appendChild(b);
        });
        updateNavigation();
    }

    function updateNavigation() {
        var btns = document.querySelectorAll("#questionNav button");
        btns.forEach(function (b, i) {
            var q = questions[i];
            b.className = "";
            if (i === currentIndex) b.classList.add("btn-primary");
            if (!q) return;
            if (isAnswered(q)) b.classList.add(isCorrect(q) ? "btn-success" : "btn-danger");
            else if (isReviewMode) b.classList.add("btn-danger");
        });
        var cur = btns[currentIndex];
        if (cur && cur.scrollIntoView && document.activeElement !== cur) {
            var nav = $("questionNav");
            if (cur.offsetTop < nav.scrollTop || cur.offsetTop > nav.scrollTop + nav.clientHeight - 40) nav.scrollTop = cur.offsetTop - 60;
        }
    }

    function updateAll() {
        updateNavigation();
        var total = questions.length;
        var answered = questions.filter(isAnswered).length;
        var ok = questions.filter(function (q) { return isAnswered(q) && isCorrect(q); }).length;
        var bad = answered - ok;
        $("ntOk").textContent = ok;
        $("ntBad").textContent = bad;
        $("ntLeft").textContent = total - answered;
        $("ntMapCount").textContent = answered + " / " + total;
        $("ntBar").style.width = (total ? 100 * answered / total : 0) + "%";
        $("ntSub").textContent = isReviewMode ? t("test.review") : t("test.qOf", { n: Math.min(currentIndex + 1, total), total: total });
        $("ntPrev").disabled = $("ntPrevM").disabled = currentIndex <= 0;
        $("ntNext").disabled = $("ntNextM").disabled = currentIndex >= total - 1;

        var lives = $("ntLives");
        if (lives) {
            lives.hidden = !examMode;
            lives.querySelectorAll("i").forEach(function (h, i) { h.classList.toggle("lost", i < bad); });
        }
        var finHidden = isReviewMode;
        $("finishBtn").hidden = $("finishBtnM").hidden = finHidden;
    }

    function preload() {
        for (var i = currentIndex + 1; i <= currentIndex + 2 && i < questions.length; i++) {
            if (questions[i] && questions[i].imageUrl) new Image().src = "/uploads/" + questions[i].imageUrl;
        }
    }

    function go(delta) {
        var n = currentIndex + delta;
        if (n < 0 || n >= questions.length) return;
        currentIndex = n;
        renderQuestion();
    }

    // ───────────── Real imtihon ─────────────

    var timer = { id: null, deadline: 0 };

    function fmt(sec) {
        var m = Math.floor(sec / 60), s = sec % 60;
        return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }

    function timerTick() {
        var left = timer.deadline - Date.now();
        var sec = Math.max(0, Math.ceil(left / 1000));
        var el = $("ntTimer");
        $("ntTimerVal").textContent = fmt(sec);
        $("ntTimerBar").style.width = Math.max(0, left) / (EXAM_SECONDS * 1000) * 100 + "%";
        el.classList.toggle("warn", sec <= 300 && sec > 60);
        el.classList.toggle("crit", sec <= 60);
        if (left <= 0) {
            stopTimer();
            el.classList.add("done");
            endExam("time");
        }
    }

    function startTimer() {
        stopTimer();
        timer.deadline = Date.now() + EXAM_SECONDS * 1000;
        var el = $("ntTimer");
        el.hidden = false;
        el.classList.remove("done", "warn", "crit");
        timerTick();
        timer.id = setInterval(timerTick, 250);
    }

    function stopTimer() { if (timer.id) clearInterval(timer.id); timer.id = null; }

    function startExam() {
        examMode = true;
        examOver = false;
        endReason = null;
        startTimer();
    }

    function endExam(reason) {
        if (examOver) return;
        endReason = reason;
        finishTest();
    }

    function askConfirm(q, o, index) {
        if (isAnswered(q) || isReviewMode || examOver) return;
        pendingAnswer = { q: q, o: o, index: index };
        renderConfirm();
        openModal("answerConfirm");
        $("acYes").focus();
    }

    function renderConfirm() {
        if (!pendingAnswer) return;
        $("acKey").textContent = "F" + (pendingAnswer.index + 1);
        $("acText").textContent = getOptionText(pendingAnswer.o);
    }

    function closeConfirm(accept) {
        var p = pendingAnswer;
        pendingAnswer = null;
        closeModal("answerConfirm");
        if (accept && p) selectAnswer(p.q, p.o);
    }

    // ───────────── Oynalar ─────────────

    function openModal(id) {
        var m = $(id);
        m.hidden = false;
        requestAnimationFrame(function () { m.classList.add("show"); });
    }

    function closeModal(id) {
        var m = $(id);
        m.classList.remove("show");
        m.hidden = true;
    }

    // ───────────── Yakunlash ─────────────

    function checkAutoFinish() {
        if (Object.keys(answers).length === questions.length) finishTest();
    }

    function finishTest() {
        if (!questions.length) return;
        if (pendingAnswer) closeConfirm(false);
        flushTime();
        if (examMode) { examOver = true; stopTimer(); }

        var correct = 0, skipped = 0;
        incorrectQuestionsGlobal = [];
        questions.forEach(function (q) {
            if (isAnswered(q)) {
                if (isCorrect(q)) correct++;
                else incorrectQuestionsGlobal.push(q);
            } else {
                skipped++;
            }
        });

        var total = questions.length;
        var percent = total > 0 ? Math.round(correct / total * 100) : 0;
        // Real imtihon: 18 ta to'g'ri; boshqa testlar: savollarning 90% i
        var passed = examMode ? correct >= 18 : correct >= Math.ceil(total * 0.9);

        var timedIds = Object.keys(times).filter(function (id) { return answers[id] !== undefined; });
        var avgSec = timedIds.length ? timedIds.reduce(function (s, id) { return s + times[id]; }, 0) / timedIds.length / 1000 : null;

        lastResult = {
            correct: correct, total: total, percent: percent, wrong: incorrectQuestionsGlobal.length, skipped: skipped,
            passed: passed, reason: examMode ? endReason : null, bilet: cfg.bilet || null, avgSec: avgSec
        };
        renderResult();
        $("reviewErrorsBtn").hidden = incorrectQuestionsGlobal.length === 0;
        openModal("resultCard");
        updateAll();
        save();
    }

    function renderResult() {
        if (!lastResult) return;
        var r = lastResult;
        var ring = $("ntResRing");
        ring.style.setProperty("--c", r.passed ? "var(--ca-ok)" : r.percent >= 60 ? "var(--ca-warn)" : "#f43f5e");
        ring.style.setProperty("--p", r.percent);
        $("ntResPct").textContent = r.percent + "%";
        $("ntResTitle").textContent = r.bilet ? t("bilet.title") + r.bilet : t("test.result");
        var badge = $("ntResBadge");
        badge.className = "nt-res-badge " + (r.passed ? "ok" : "bad");
        badge.textContent = t(r.passed ? "test.passed" : "test.failed");
        $("ntResOk").textContent = r.correct;
        $("ntResBad").textContent = r.wrong;
        $("ntResSkip").textContent = r.skipped;
        $("ntResTime").textContent = r.avgSec ? t("nv.sec", { n: r.avgSec.toFixed(1) }) : "—";

        var el = $("resultText");
        el.textContent = "";
        if (r.reason) {
            var why = document.createElement("div");
            why.className = "exam-end-reason";
            why.textContent = t(r.reason === "time" ? "test.endTime" : "test.endMistakes");
            el.appendChild(why);
        }
        [
            t("test.correct", { correct: r.correct, total: r.total, percent: r.percent }),
            t("test.wrong", { n: r.wrong }),
            t("test.skipped", { n: r.skipped })
        ].forEach(function (line, i) {
            if (i > 0) el.appendChild(document.createElement("br"));
            el.appendChild(document.createTextNode(line));
        });
    }

    function save() {
        if (!cfg.save || !round) return;
        var items = questions.map(function (q) {
            var sel = answers[q.id];
            return {
                questionId: q.id,
                selectedOptionId: sel === undefined || sel === null ? null : Number(sel),
                timeMs: times[q.id] ? Math.round(times[q.id]) : null
            };
        });
        if (!items.some(function (i) { return i.selectedOptionId !== null; })) return;

        var status = $("ntSaved");
        status.className = "nt-saved";
        status.textContent = "…";
        fetch("/Cabinet/SaveResult", {
            method: "POST",
            credentials: "same-origin",
            keepalive: true,
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                attemptKey: round.key,
                testType: cfg.type,
                testRef: cfg.reference || null,
                isErrorReview: cfg.type !== "mistakes" && round.fromErrors,
                startedAt: round.startedAt,
                items: items
            })
        }).then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        }).then(function () {
            status.className = "nt-saved ok";
            status.textContent = "✓ " + t("tracker.saved");
        }).catch(function () {
            status.className = "nt-saved bad";
            status.textContent = t("tracker.failed");
        });
    }

    function restart(list, fromErrors) {
        questions = clone(list);
        answers = {};
        shuffledOrders = {};
        currentIndex = 0;
        isReviewMode = false;
        lastResult = null;
        startRound(fromErrors);
        closeModal("resultCard");
        createNavigation();
        renderQuestion();
    }

    // ───────────── Tugmalar ─────────────

    $("reviewErrorsBtn").onclick = function () {
        if (!incorrectQuestionsGlobal.length) return;
        // Xatolar ustida ishlash — mashq: vaqt va "3 ta xato" qoidasi yo'q
        if (cfg.exam) {
            examMode = false;
            examOver = false;
            stopTimer();
            $("ntTimer").hidden = true;
        }
        restart(incorrectQuestionsGlobal, true);
    };

    $("reviewBtn").onclick = function () {
        closeModal("resultCard");
        flushTime();
        isReviewMode = true;
        currentIndex = 0;
        renderQuestion();
    };

    $("retryBtn").onclick = function () {
        restart(limited(originalQuestions), false);
        if (cfg.exam) startExam();
    };

    function exit() { location.href = cfg.exitUrl || "/"; }
    function finishClick() {
        if (isReviewMode || !$("resultCard").hidden) return;
        finishTest();
    }

    $("finishBtn").onclick = finishClick;
    $("finishBtnM").onclick = finishClick;
    $("exitBtn").onclick = exit;
    $("ntExitM").onclick = exit;
    $("ntPrev").onclick = $("ntPrevM").onclick = function () { go(-1); };
    $("ntNext").onclick = $("ntNextM").onclick = function () { go(1); };
    $("acYes").onclick = function () { closeConfirm(true); };
    $("acNo").onclick = function () { closeConfirm(false); };
    $("answerConfirm").onclick = function (e) { if (e.target === this) closeConfirm(false); };
    $("resultCard").onclick = function (e) { if (e.target === this) closeModal("resultCard"); };

    // Rasmni kattalashtirish
    $("ntImgBox").onclick = function () {
        var src = $("questionImage").getAttribute("src");
        if (!src || this.classList.contains("logo")) return;
        $("modalImg").src = src;
        $("imageModal").hidden = false;
    };
    $("imageModal").onclick = function () { this.hidden = true; };

    // To'liq ekran
    var full = $("ntFull");
    if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
        full.hidden = false;
        full.onclick = function () {
            var on = document.fullscreenElement || document.webkitFullscreenElement;
            if (on) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            else {
                var root = document.documentElement, req = root.requestFullscreen || root.webkitRequestFullscreen;
                var p = req.call(root);
                if (p && p.catch) p.catch(function () { });
            }
        };
        document.addEventListener("fullscreenchange", function () { full.classList.toggle("on", !!document.fullscreenElement); });
    }

    document.addEventListener("keydown", function (e) {
        if (pendingAnswer) {
            // Tasdiqlash oynasi ochiq: Enter — Ha, Esc — Yo'q; boshqa tugmalar ishlamaydi
            if (e.key === "Escape") { e.preventDefault(); closeConfirm(false); }
            else if (e.key === "Enter") { e.preventDefault(); closeConfirm(true); }
            else if (e.key !== "Tab") e.preventDefault();
            return;
        }
        if (e.target && e.target.closest && e.target.closest(".ui-dd")) return;
        if (e.key === "Escape") {
            if (!$("imageModal").hidden) { $("imageModal").hidden = true; return; }
            if (!$("resultCard").hidden) { closeModal("resultCard"); }
            return;
        }
        if (!$("resultCard").hidden) return;
        if (e.key === "ArrowRight") { go(1); return; }
        if (e.key === "ArrowLeft") { go(-1); return; }
        if (/^F\d$/.test(e.key)) {
            if (isReviewMode || examOver) return;
            var n = parseInt(e.key.slice(1), 10) - 1;
            var q = questions[currentIndex];
            if (!q || isAnswered(q)) return;
            var order = shuffledOrders[q.id];
            if (order && order[n] !== undefined) {
                var o = q.options[order[n]];
                if (o) { e.preventDefault(); choose(q, o, n); }
            }
        }
    });

    // Til almashtirilganda — savol, natija va tasdiqlash oynasi qayta chiziladi
    document.addEventListener("i18n:change", function () {
        if (questions.length) renderQuestion();
        renderResult();
        renderConfirm();
        var nameEl = $("ntName");
        document.title = nameEl.textContent + " — AvtoPrava Nova";
    });

    document.addEventListener("DOMContentLoaded", async function () {
        try {
            await loadQuestions();
            startRound(false);
            if (questions.length) {
                renderQuestion();
                if (cfg.exam) startExam();
            } else {
                updateAll();
            }
        } catch (err) {
            console.error(err);
            $("questionText").textContent = t("test.loadError");
            showError(err && err.message ? err.message : t("test.unknownError"));
        }
    });

    // Tekshiruv uchun: joriy holatni o'qish (o'zgartirmaydi)
    window.NovaTestDebug = { get state() { return { questions: questions, answers: answers, currentIndex: currentIndex, times: times }; } };
})();
