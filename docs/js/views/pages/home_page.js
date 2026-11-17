/**
 * Home Dashboard & Problems Sheet Page
 * Renders problem statistics gauge, streak calendar, company cloud, active filter tags,
 * and the complete problems data table.
 */

import { state, isQuestionSolved, isQuestionAttempted } from "../../models/state.js";
import { Storage } from "../../models/storage.js";
import { Activity, dayKey } from "../../models/activity.js";
import { el, escapeHTML, showToast } from "../../utils.js";


export const TOPICS = [
  { id: "aggregation", label: "Aggregation", icon: "∑", tags: ["aggregation"] },
  { id: "join", label: "Joins", icon: "⋈", tags: ["join", "left-join", "self-join"] },
  { id: "window", label: "Window functions", icon: "▦", tags: ["window-function", "lead-lag", "ranking"] },
  { id: "date", label: "Dates & time", icon: "◷", tags: ["date-manipulation"] },
  { id: "cte", label: "CTEs", icon: "⧉", tags: ["cte"] },
  { id: "math", label: "Math & ratios", icon: "%", tags: ["math"] },
  { id: "logic", label: "Conditional logic", icon: "?", tags: ["conditional-logic", "case-statement"] }
];

const DIFF_RANK = { easy: 1, medium: 2, hard: 3 };

export function topicsOf(q) {
  return TOPICS.filter(t => (q.tags || []).some(tag => t.tags.includes(tag)));
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getDailyChallenge() {
  if (!state.questions.length) return null;
  const pool = state.questions.filter(q => !state.solvedSlugs.has(q.slug));
  const list = pool.length ? pool : state.questions;
  return list[hashStr(dayKey()) % list.length];
}

const ICON_ARROW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

export const HomePage = {
  applyTopicsVisibility() {
    el("view-home")?.classList.toggle("topics-hidden", !state.showTopics);
    el("btn-topics-toggle")?.setAttribute("aria-pressed", String(state.showTopics));
    HomePage.syncToolbarHeight();
  },

  syncToolbarHeight() {
    const tb = document.querySelector(".home-sheet-main .refined-filter-toolbar");
    const home = el("view-home");
    if (!tb || !home) return;
    home.style.setProperty("--toolbar-h", `${tb.offsetHeight + 8}px`);
    if (!HomePage._ro && "ResizeObserver" in window) {
      HomePage._ro = new ResizeObserver(() => HomePage.syncToolbarHeight());
      HomePage._ro.observe(tb);
    }
  },

  renderHomeDashboard() {
    HomePage.applyTopicsVisibility();
    const total = state.questions.length || 100;
    const solved = state.solvedSlugs.size;
    const attempting = Array.from(state.attemptedSlugs).filter(s => !state.solvedSlugs.has(s)).length;

    const bigNumEl = el("home-stat-solved-big");
    const denomEl = el("home-stat-total-denom");
    const attemptingEl = el("home-stat-attempting");

    if (bigNumEl) bigNumEl.textContent = solved;
    if (denomEl) denomEl.textContent = `/${total}`;
    if (attemptingEl) {
      attemptingEl.textContent = `${attempting} Attempting`;
    }

    const totalSubmissions = Storage.getSubmissionCount();
    const accIntEl = el("home-stat-acc-int");
    const accDecEl = el("home-stat-acc-dec");
    const subsEl = el("home-stat-submissions");

    let accInt = "0";
    let accDec = ".00%";
    if (totalSubmissions > 0) {
      const rate = (solved / totalSubmissions) * 100;
      const parts = rate.toFixed(2).split(".");
      accInt = parts[0];
      accDec = "." + parts[1] + "%";
    }

    if (accIntEl) accIntEl.textContent = accInt;
    if (accDecEl) accDecEl.textContent = accDec;
    if (subsEl) {
      subsEl.textContent = `${totalSubmissions} submission${totalSubmissions === 1 ? "" : "s"}`;
    }

    const easyQuestions = state.questions.filter(q => q.difficulty.toLowerCase() === "easy");
    const medQuestions = state.questions.filter(q => q.difficulty.toLowerCase() === "medium");
    const hardQuestions = state.questions.filter(q => q.difficulty.toLowerCase() === "hard");

    const easyTotal = easyQuestions.length || 34;
    const easySolved = easyQuestions.filter(q => state.solvedSlugs.has(q.slug)).length;
    const medTotal = medQuestions.length || 39;
    const medSolved = medQuestions.filter(q => state.solvedSlugs.has(q.slug)).length;
    const hardTotal = hardQuestions.length || 27;
    const hardSolved = hardQuestions.filter(q => state.solvedSlugs.has(q.slug)).length;

    const sEasy = el("home-stat-easy");
    const sMed = el("home-stat-medium");
    const sHard = el("home-stat-hard");
    if (sEasy) sEasy.textContent = `${easySolved}/${easyTotal}`;
    if (sMed) sMed.textContent = `${medSolved}/${medTotal}`;
    if (sHard) sHard.textContent = `${hardSolved}/${hardTotal}`;

    const solvedArc = el("gauge-arc-solved");
    const attemptedArc = el("gauge-arc-attempted");

    const solvedPct = total > 0 ? (solved / total) * 100 : 0;
    const attemptingPct = total > 0 ? (attempting / total) * 100 : 0;

    if (solvedArc) {
      if (solvedPct <= 0) {
        solvedArc.setAttribute("stroke-dasharray", "0 100");
        solvedArc.setAttribute("stroke-dashoffset", "0");
        solvedArc.style.display = "none";
      } else {
        solvedArc.setAttribute("stroke-dasharray", `${solvedPct} 100`);
        solvedArc.setAttribute("stroke-dashoffset", "0");
        solvedArc.style.display = "";
        solvedArc.style.removeProperty("opacity");
      }
    }

    if (attemptedArc) {
      if (attempting <= 0) {
        attemptedArc.setAttribute("stroke-dasharray", "0 100");
        attemptedArc.style.display = "none";
      } else {
        const arcLen = Math.max(attemptingPct, 2.2);
        const gap = solvedPct > 0 ? 1.4 : 0;
        const offset = -(solvedPct + gap);
        attemptedArc.setAttribute("stroke-dasharray", `${arcLen} 100`);
        attemptedArc.setAttribute("stroke-dashoffset", `${offset}`);
        attemptedArc.style.display = "";
        attemptedArc.style.removeProperty("opacity");
      }
    }

    const arcEasy = el("gauge-arc-easy");
    const arcMed = el("gauge-arc-med");
    const arcHard = el("gauge-arc-hard");

    const easyPctOfTotal = total > 0 ? (easySolved / total) * 100 : 0;
    const medPctOfTotal = total > 0 ? (medSolved / total) * 100 : 0;
    const hardPctOfTotal = total > 0 ? (hardSolved / total) * 100 : 0;

    const segGap = 0.8;
    let currentOffset = 0;

    if (arcEasy) {
      if (easySolved > 0) {
        arcEasy.setAttribute("stroke-dasharray", `${easyPctOfTotal} 100`);
        arcEasy.setAttribute("stroke-dashoffset", "0");
        currentOffset += easyPctOfTotal + segGap;
      } else {
        arcEasy.setAttribute("stroke-dasharray", "0 100");
        arcEasy.setAttribute("stroke-dashoffset", "0");
      }
    }

    if (arcMed) {
      if (medSolved > 0) {
        arcMed.setAttribute("stroke-dasharray", `${medPctOfTotal} 100`);
        arcMed.setAttribute("stroke-dashoffset", `-${currentOffset}`);
        currentOffset += medPctOfTotal + segGap;
      } else {
        arcMed.setAttribute("stroke-dasharray", "0 100");
        arcMed.setAttribute("stroke-dashoffset", "0");
      }
    }

    if (arcHard) {
      if (hardSolved > 0) {
        arcHard.setAttribute("stroke-dasharray", `${hardPctOfTotal} 100`);
        arcHard.setAttribute("stroke-dashoffset", `-${currentOffset}`);
      } else {
        arcHard.setAttribute("stroke-dasharray", "0 100");
        arcHard.setAttribute("stroke-dashoffset", "0");
      }
    }

    const gaugeCard = el("progress-gauge-card");
    if (gaugeCard && !gaugeCard._hasHoverListeners) {
      gaugeCard._hasHoverListeners = true;
      gaugeCard.addEventListener("mouseenter", () => {
        gaugeCard.classList.add("is-hovered");
        const sA = el("gauge-arc-solved");
        const aA = el("gauge-arc-attempted");
        if (sA) sA.style.display = "none";
        if (aA) aA.style.display = "none";
      });
      gaugeCard.addEventListener("mouseleave", () => {
        gaugeCard.classList.remove("is-hovered");
        const sA = el("gauge-arc-solved");
        const aA = el("gauge-arc-attempted");
        if (sA && state.solvedSlugs.size > 0) sA.style.display = "";
        const attCount = Array.from(state.attemptedSlugs).filter(s => !state.solvedSlugs.has(s)).length;
        if (aA && attCount > 0) aA.style.display = "";
      });
    }

    HomePage.renderHero();
    HomePage.renderToday();
    HomePage.renderTopics();
    HomePage.renderStreakCalendar();
    HomePage.populateCompanyFilterOptions();

    const counterPill = el("filter-progress-count");
    if (counterPill) counterPill.textContent = `${solved} / ${total}`;

    HomePage.updateHomeCompanyCloud(el("home-company-search-input")?.value || "");
    HomePage.updateStarredSidebar();
    HomePage.updateNotesSidebar();

    HomePage.renderActiveFilterTags();
    HomePage.renderHomeProblemsTable();
  },

  renderHero() {
    const hour = new Date().getHours();
    const greet = hour < 5 ? "Burning the midnight oil" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const total = state.questions.length || 100;
    const solved = state.solvedSlugs.size;
    const streak = Activity.currentStreak();

    const badge = el("home-date-badge");
    if (badge) badge.textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const g = el("home-greeting");
    if (g) g.textContent = solved === 0 ? "Let's write your first query" : `${greet}. ${solved} of ${total} solved`;

    const sub = el("home-hero-sub");
    if (sub) {
      if (solved === 0) {
        sub.textContent = `${total} real interview questions, a full MySQL 8.0 engine in your browser, and instant test case validation. Nothing to install and nothing leaves your machine.`;
      } else if (solved === total) {
        sub.textContent = "You have solved every question. Revisit starred problems or try them again against the clock.";
      } else {
        const left = total - solved;
        sub.textContent = streak > 1
          ? `You are on a ${streak}-day streak. ${left} question${left === 1 ? "" : "s"} to go. Solve one today to keep it alive.`
          : `${left} question${left === 1 ? "" : "s"} to go. One solved problem a day adds up quickly.`;
      }
    }

    const set = (id, v) => { const n = el(id); if (n) n.textContent = v; };
    set("hero-stat-streak", streak);
    set("hero-stat-best", Activity.longestStreak());
    set("hero-stat-week", Activity.solvesInLastDays(7));
    const subs = Storage.getSubmissionCount();
    set("hero-stat-acc", subs > 0 ? `${Math.min(100, Math.round((solved / subs) * 100))}%` : "–");

    const kbd = el("home-palette-kbd");
    if (kbd) kbd.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";

    const label = el("home-resume-label");
    const cont = HomePage.getContinueTarget();
    if (label) label.textContent = cont && (isQuestionAttempted(cont.slug) || localStorage.getItem("sqlmaster_current_slug") === cont.slug)
      ? `Continue: ${cont.title}` : "Start practicing";
  },

  getContinueTarget() {
    const savedSlug = localStorage.getItem("sqlmaster_current_slug");
    return (savedSlug && state.questions.find(q => q.slug === savedSlug && !state.solvedSlugs.has(q.slug))) ||
           state.questions.find(q => isQuestionAttempted(q.slug)) ||
           state.questions.find(q => !isQuestionSolved(q.slug)) ||
           state.questions[0] || null;
  },

  topicStats() {
    return TOPICS.map(t => {
      const qs = state.questions.filter(q => topicsOf(q).some(x => x.id === t.id));
      const solved = qs.filter(q => state.solvedSlugs.has(q.slug)).length;
      return { ...t, total: qs.length, solved, pct: qs.length ? solved / qs.length : 0, questions: qs };
    }).filter(t => t.total > 0);
  },

  pillHTML(q) {
    const d = q.difficulty.toLowerCase();
    return `<span class="doc-diff-pill ${d}"><span class="diff-dot">●</span> ${q.difficulty}</span>`;
  },

  renderToday() {
    const daily = getDailyChallenge();
    const dailyEl = el("today-daily");
    if (dailyEl && daily) {
      const done = state.solvedSlugs.has(daily.slug);
      dailyEl.innerHTML = `
        <div class="today-eyebrow"><span class="today-dot daily"></span>Daily challenge</div>
        <h3 class="today-title">${escapeHTML(daily.title)}</h3>
        <div class="today-meta">${HomePage.pillHTML(daily)}<span class="doc-meta-pill">${escapeHTML(daily.company || "General")}</span></div>
        <button class="today-cta" data-slug="${daily.slug}">${done ? "Solved. Review it" : "Start today's problem"} ${ICON_ARROW}</button>`;
    }

    const cont = HomePage.getContinueTarget();
    const contEl = el("today-continue");
    if (contEl) {
      if (!cont) {
        contEl.innerHTML = "";
      } else {
        const draft = localStorage.getItem(`sqlmaster_draft_${cont.slug}`) || "";
        const hasDraft = draft.trim().length > 0;
        const preview = hasDraft ? escapeHTML(draft.trim().split("\n").slice(0, 3).join("\n").slice(0, 140)) : "";
        contEl.innerHTML = `
          <div class="today-eyebrow"><span class="today-dot cont"></span>${hasDraft ? "Pick up where you left off" : "Up next"}</div>
          <h3 class="today-title">${escapeHTML(cont.title)}</h3>
          <div class="today-meta">${HomePage.pillHTML(cont)}<span class="doc-meta-pill">${escapeHTML(cont.company || "General")}</span></div>
          ${hasDraft ? `<pre class="today-draft">${preview}</pre>` : ""}
          <button class="today-cta" data-slug="${cont.slug}">${hasDraft ? "Resume your query" : "Open question"} ${ICON_ARROW}</button>`;
      }
    }

    const recEl = el("today-recommended");
    if (recEl) {
      const stats = HomePage.topicStats().filter(t => t.solved < t.total);
      stats.sort((a, b) => a.pct - b.pct || b.total - a.total);
      const weakest = stats[0];
      let rec = null;
      if (weakest) {
        rec = weakest.questions
          .filter(q => !state.solvedSlugs.has(q.slug))
          .sort((a, b) => DIFF_RANK[a.difficulty.toLowerCase()] - DIFF_RANK[b.difficulty.toLowerCase()])[0];
      }
      if (!rec) {
        recEl.innerHTML = `
          <div class="today-eyebrow"><span class="today-dot rec"></span>Recommended</div>
          <h3 class="today-title">Everything is solved</h3>
          <p class="today-note">Nothing left to recommend. Star problems you want to revisit.</p>`;
      } else {
        recEl.innerHTML = `
          <div class="today-eyebrow"><span class="today-dot rec"></span>Strengthen: ${escapeHTML(weakest.label)}</div>
          <h3 class="today-title">${escapeHTML(rec.title)}</h3>
          <div class="today-meta">${HomePage.pillHTML(rec)}<span class="doc-meta-pill">${weakest.solved}/${weakest.total} in this topic</span></div>
          <button class="today-cta" data-slug="${rec.slug}">Try it ${ICON_ARROW}</button>`;
      }
    }

    document.querySelectorAll("#home-today-grid .today-cta").forEach(btn => {
      btn.onclick = () => state.emit("navigateToQuestion", btn.dataset.slug);
    });
  },

  renderTopics() {
    const grid = el("home-topics-grid");
    if (!grid) return;
    const stats = HomePage.topicStats();
    grid.innerHTML = stats.map(t => `
      <button class="topic-card ${state.homeTag === t.id ? "active" : ""}" data-topic="${t.id}" aria-pressed="${state.homeTag === t.id}">
        <span class="topic-icon">${t.icon}</span>
        <span class="topic-body">
          <span class="topic-name">${t.label}</span>
          <span class="topic-count">${t.solved} / ${t.total} solved</span>
          <span class="topic-bar"><span class="topic-bar-fill" style="width:${Math.round(t.pct * 100)}%"></span></span>
        </span>
      </button>`).join("");
    grid.querySelectorAll(".topic-card").forEach(btn => {
      btn.addEventListener("click", () => {
        state.homeTag = state.homeTag === btn.dataset.topic ? null : btn.dataset.topic;
        HomePage.renderTopics();
        HomePage.renderActiveFilterTags();
        HomePage.renderHomeProblemsTable();
        if (state.homeTag) el("home-sheet-counter")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  },

  renderStreakCalendar() {
    const calGrid = el("streak-calendar-grid");
    if (!calGrid) return;

    const now = new Date();
    const view = new Date(now.getFullYear(), now.getMonth() + (state.calMonthOffset || 0), 1);
    const year = view.getFullYear();
    const month = view.getMonth();
    const title = el("streak-month-title");
    if (title) title.textContent = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lead = (view.getDay() + 6) % 7; // Monday first
    const todayKey = dayKey(now);
    const all = Activity.all();
    let html = "";
    for (let i = 0; i < lead; i++) html += `<div class="cal-day-cell empty"></div>`;

    let activeDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dayKey(new Date(year, month, day));
      const rec = all[key];
      const active = !!rec && (rec.runs + rec.submits + rec.solves) > 0;
      if (active) activeDays++;
      const future = key > todayKey;
      let cls = "cal-day-cell";
      if (active) cls += " active-streak";
      if (key === todayKey) cls += " today";
      if (future) cls += " future";
      const tip = active
        ? `${key}: ${rec.solves} solved, ${rec.submits} submissions, ${rec.runs} runs`
        : key === todayKey ? "Today: no practice yet" : key;
      html += `<div class="${cls}" title="${tip}">${day}</div>`;
    }
    calGrid.innerHTML = html;

    const next = el("btn-streak-next");
    if (next) next.disabled = (state.calMonthOffset || 0) >= 0;

    const foot = el("streak-footer");
    if (foot) foot.innerHTML = `<span><strong>${activeDays}</strong> active day${activeDays === 1 ? "" : "s"} this month</span><span>Current streak <strong>${Activity.currentStreak()}</strong> · Best <strong>${Activity.longestStreak()}</strong></span>`;
  },

  populateCompanyFilterOptions() {
    const container = el("menu-company-list");
    if (!container) return;

    const companies = Array.from(new Set(state.questions.map(q => q.company).filter(Boolean))).sort();
    const searchVal = (el("menu-search-companies")?.value || "").toLowerCase().trim();

    const filtered = companies.filter(c => !searchVal || c.toLowerCase().includes(searchVal));

    if (filtered.length === 0) {
      container.innerHTML = `<div style="padding: 10px 14px; font-size: 0.78rem; color: var(--text-muted);">No matching companies</div>`;
      return;
    }

    container.innerHTML = `
      <label class="filter-menu-opt">
        <input type="radio" name="company-filter" value="all" ${state.homeCompany === "all" ? "checked" : ""} />
        <span>All Companies</span>
      </label>
      ${filtered.map(c => {
        const cnt = state.questions.filter(q => q.company === c).length;
        return `
          <label class="filter-menu-opt">
            <input type="radio" name="company-filter" value="${escapeHTML(c)}" ${state.homeCompany === c ? "checked" : ""} />
            <span>${escapeHTML(c)}</span>
            <span style="margin-left: auto; font-size: 0.72rem; color: var(--text-muted);">(${cnt})</span>
          </label>
        `;
      }).join("")}
    `;

    container.querySelectorAll('input[name="company-filter"]').forEach(radio => {
      radio.addEventListener("change", () => {
        state.homeCompany = radio.value;
        const menu = el("menu-filter-company");
        if (menu) menu.style.display = "none";
        HomePage.renderActiveFilterTags();
        HomePage.renderHomeProblemsTable();
      });
    });
  },

  renderActiveFilterTags() {
    const container = el("home-filter-tags-row");
    const resetBtn = el("btn-filter-reset-all");
    if (!container) return;

    const tags = [];
    if (state.homeSegment !== "all") {
      tags.push({ type: "segment", label: state.homeSegment === "starred" ? "Starred" : "Notes", val: state.homeSegment });
    }
    state.homeStatusFilters.forEach(s => {
      const label = s === "solved" ? "Solved" : (s === "attempted" || s === "in-progress") ? "Attempted" : "Not Attempted";
      tags.push({ type: "status", label, val: s });
    });
    state.homeDiffFilters.forEach(d => {
      tags.push({ type: "diff", label: d.charAt(0).toUpperCase() + d.slice(1), val: d });
    });
    if (state.homeCompany && state.homeCompany !== "all") {
      tags.push({ type: "company", label: state.homeCompany, val: state.homeCompany });
    }
    if (state.homeTag) {
      const t = TOPICS.find(x => x.id === state.homeTag);
      tags.push({ type: "topic", label: `Topic: ${t ? t.label : state.homeTag}`, val: state.homeTag });
    }

    const btnStatus = el("btn-filter-status");
    const btnDiff = el("btn-filter-diff");
    const btnCompany = el("btn-filter-company");
    if (btnStatus) btnStatus.classList.toggle("is-filtered", state.homeStatusFilters.size > 0);
    if (btnDiff) btnDiff.classList.toggle("is-filtered", state.homeDiffFilters.size > 0);
    if (btnCompany) btnCompany.classList.toggle("is-filtered", state.homeCompany !== "all");

    if (resetBtn) {
      resetBtn.style.display = tags.length > 0 ? "inline-flex" : "none";
    }

    if (tags.length === 0) {
      container.style.display = "none";
      container.innerHTML = "";
      return;
    }

    container.style.display = "flex";
    container.innerHTML = tags.map(t => `
      <span class="active-tag-chip">
        <span>${escapeHTML(t.label)}</span>
        <button class="tag-x-btn" data-type="${t.type}" data-val="${t.val}" title="Remove filter">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </span>
    `).join("");

    container.querySelectorAll(".tag-x-btn").forEach(xBtn => {
      xBtn.addEventListener("click", () => {
        const type = xBtn.dataset.type;
        const val = xBtn.dataset.val;
        if (type === "segment") {
          state.homeSegment = "all";
          document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b.dataset.segment === "all"));
        } else if (type === "status") {
          state.homeStatusFilters.delete(val);
          const cb = document.querySelector(`.filter-cb-status[value="${val}"]`);
          if (cb) cb.checked = false;
        } else if (type === "diff") {
          state.homeDiffFilters.delete(val);
          const cb = document.querySelector(`.filter-cb-diff[value="${val}"]`);
          if (cb) cb.checked = false;
        } else if (type === "topic") {
          state.homeTag = null;
          HomePage.renderTopics();
        } else if (type === "company") {
          state.homeCompany = "all";
          const radio = document.querySelector('input[name="company-filter"][value="all"]');
          if (radio) radio.checked = true;
        }
        HomePage.renderActiveFilterTags();
        HomePage.renderHomeProblemsTable();
      });
    });
  },

  updateStarredSidebar() {
    const starredList = state.questions.filter(q => state.starredSlugs.has(q.slug));
    const sCount = el("home-starred-count");
    const sList = el("home-starred-list");
    if (sCount) sCount.textContent = starredList.length;
    if (!sList) return;

    if (starredList.length === 0) {
      sList.innerHTML = `<div class="empty-state-notice" style="padding: 14px 10px; color: var(--text-dark-muted); font-size: 0.82rem; text-align: center;">No bookmarked questions yet.<br>Click <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; vertical-align:-1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> on any problem to pin here.</div>`;
      return;
    }

    sList.innerHTML = starredList.slice(0, 6).map(q => `
      <div class="sidebar-list-item" data-slug="${q.slug}" title="${escapeHTML(q.title)}">
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; padding-right: 8px;">
          <div class="sidebar-item-title">${escapeHTML(q.title)}</div>
          <div style="font-size: 0.72rem; color: var(--text-dark-muted);">${escapeHTML(q.company || "General")}</div>
        </div>
        <span class="doc-diff-pill ${q.difficulty.toLowerCase()}">${q.difficulty}</span>
      </div>
    `).join("");

    sList.querySelectorAll(".sidebar-list-item").forEach(item => {
      item.addEventListener("click", () => {
        state.emit("navigateToQuestion", item.dataset.slug);
      });
    });
  },

  updateNotesSidebar() {
    const notedSlugs = Object.keys(state.userNotes);
    const nCount = el("home-notes-count");
    const nList = el("home-recent-notes-list");
    if (nCount) nCount.textContent = notedSlugs.length;
    if (!nList) return;

    if (notedSlugs.length === 0) {
      nList.innerHTML = `<div class="empty-state-notice" style="padding: 14px 10px; color: var(--text-dark-muted); font-size: 0.82rem; text-align: center;">No personal notes yet.<br>Add notes while practicing to review.</div>`;
      return;
    }

    nList.innerHTML = notedSlugs.slice(0, 6).map(slug => {
      const q = state.questions.find(item => item.slug === slug);
      const title = q ? q.title : slug;
      const note = state.userNotes[slug];
      return `
        <div class="sidebar-list-item" data-slug="${slug}" title="${escapeHTML(title)}">
          <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; padding-right: 8px;">
            <div class="sidebar-item-title">${escapeHTML(title)}</div>
            <div style="font-size: 0.72rem; color: var(--text-dark-muted);">${escapeHTML(note.slice(0, 36))}${note.length > 36 ? "..." : ""}</div>
          </div>
          <span class="btn-sm-clean" style="font-size: 0.74rem;">Notes →</span>
        </div>
      `;
    }).join("");

    nList.querySelectorAll(".sidebar-list-item").forEach(item => {
      item.addEventListener("click", () => {
        state.emit("navigateToQuestion", item.dataset.slug);
        state.emit("setDocTab", "notes");
      });
    });
  },

  updateHomeCompanyCloud(query = "") {
    const cloudEl = el("home-company-tags-cloud");
    if (!cloudEl) return;

    const companyCounts = {};
    state.questions.forEach(q => {
      const c = q.company || "General";
      companyCounts[c] = (companyCounts[c] || 0) + 1;
    });

    const filterLower = (query || "").toLowerCase().trim();
    const sortedCompanies = Object.entries(companyCounts)
      .filter(([comp]) => !filterLower || comp.toLowerCase().includes(filterLower))
      .sort((a, b) => b[1] - a[1]);

    if (sortedCompanies.length === 0) {
      cloudEl.innerHTML = `<div style="font-size: 0.78rem; color: var(--text-dark-muted); padding: 8px;">No companies matching "${escapeHTML(query)}"</div>`;
      return;
    }

    cloudEl.innerHTML = sortedCompanies.map(([comp, cnt]) => `
      <button class="company-chip-btn ${state.homeCompany === comp ? 'active' : ''}" data-company="${escapeHTML(comp)}">
        ${escapeHTML(comp)} <span style="opacity: 0.65; font-size: 0.7rem;">(${cnt})</span>
      </button>
    `).join("");

    cloudEl.querySelectorAll(".company-chip-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const comp = btn.dataset.company;
        state.homeCompany = state.homeCompany === comp ? "all" : comp;
        const resetBtn = el("btn-reset-company-filter");
        if (resetBtn) resetBtn.style.display = state.homeCompany !== "all" ? "inline-block" : "none";
        HomePage.updateHomeCompanyCloud(el("home-company-search-input")?.value || "");
        HomePage.renderActiveFilterTags();
        HomePage.renderHomeProblemsTable();
      });
    });
  },

  renderHomeProblemsTable() {
    const tbody = el("home-problems-tbody");
    const emptyNotice = el("home-problems-empty");
    const counter = el("home-sheet-counter");
    if (!tbody) return;

    const query = (state.homeSearch || "").toLowerCase().trim();

    const filtered = state.questions.filter(q => {
      if (state.homeSegment === "starred" && !state.starredSlugs.has(q.slug)) return false;
      if (state.homeSegment === "notes" && !state.userNotes[q.slug]) return false;

      const hasStatusFilter = state.homeStatusFilters.size > 0;
      const hasDiffFilter = state.homeDiffFilters.size > 0;
      const hasCompanyFilter = state.homeCompany && state.homeCompany !== "all";

      if (hasStatusFilter || hasDiffFilter || hasCompanyFilter) {
        let statusMatches = true;
        if (hasStatusFilter) {
          const isSolved = isQuestionSolved(q.slug);
          const isAttempted = isQuestionAttempted(q.slug);
          let statusKey = isSolved ? "solved" : isAttempted ? "attempted" : "unsolved";
          statusMatches = state.homeStatusFilters.has(statusKey) || 
                          (statusKey === "attempted" && state.homeStatusFilters.has("in-progress"));
        }

        let diffMatches = true;
        if (hasDiffFilter) {
          diffMatches = state.homeDiffFilters.has(q.difficulty.toLowerCase());
        }

        let compMatches = true;
        if (hasCompanyFilter) {
          compMatches = (q.company === state.homeCompany);
        }

        if (state.homeMatchMode === "any") {
          const conditions = [];
          if (hasStatusFilter) conditions.push(statusMatches);
          if (hasDiffFilter) conditions.push(diffMatches);
          if (hasCompanyFilter) conditions.push(compMatches);
          if (!conditions.some(Boolean)) return false;
        } else {
          if (hasStatusFilter && !statusMatches) return false;
          if (hasDiffFilter && !diffMatches) return false;
          if (hasCompanyFilter && !compMatches) return false;
        }
      }

      if (state.homeTag && !topicsOf(q).some(t => t.id === state.homeTag)) return false;

      if (query) {
        const titleMatch = q.title.toLowerCase().includes(query);
        const companyMatch = q.company && q.company.toLowerCase().includes(query);
        const tagMatch = q.tags && q.tags.some(t => t.toLowerCase().includes(query));
        const slugMatch = q.slug.toLowerCase().includes(query);
        if (!titleMatch && !companyMatch && !tagMatch && !slugMatch) return false;
      }

      return true;
    });

    const sortMode = state.homeSort || "default";
    const rankOf = q => DIFF_RANK[q.difficulty.toLowerCase()] || 2;
    if (sortMode === "difficulty-asc") filtered.sort((a, b) => rankOf(a) - rankOf(b));
    else if (sortMode === "difficulty-desc") filtered.sort((a, b) => rankOf(b) - rankOf(a));
    else if (sortMode === "title") filtered.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortMode === "company") filtered.sort((a, b) => (a.company || "").localeCompare(b.company || "") || a.title.localeCompare(b.title));
    else if (sortMode === "unsolved") filtered.sort((a, b) => Number(isQuestionSolved(a.slug)) - Number(isQuestionSolved(b.slug)));

    if (counter) {
      counter.textContent = `${filtered.length} Problem${filtered.length === 1 ? "" : "s"}`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = "";
      if (emptyNotice) emptyNotice.style.display = "block";
      return;
    }

    if (emptyNotice) emptyNotice.style.display = "none";

    tbody.innerHTML = filtered.map(q => {
      const isSolved = isQuestionSolved(q.slug);
      const isAttempted = isQuestionAttempted(q.slug);
      const isStarred = state.starredSlugs.has(q.slug);
      const hasNote = !!state.userNotes[q.slug];
      const diff = q.difficulty.toLowerCase();
      const origIndex = state.questions.indexOf(q) + 1;
      const testCount = q.test_case_count || 4;
      const company = q.company || "General";

      const statusClass = isSolved ? "solved" : isAttempted ? "attempted" : "";
      const statusTitle = isSolved ? "Solved" : isAttempted ? "Attempted" : "Not Attempted";
      const statusIconHtml = isSolved
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        : isAttempted
        ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"/></svg>`
        : "";

      const noteIconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

      const starIconHtml = isStarred
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

      return `
        <tr class="home-table-row" data-slug="${q.slug}">
          <td style="text-align: center;">
            <span class="status-circle-icon ${statusClass}" title="${statusTitle}">
              ${statusIconHtml}
            </span>
          </td>
          <td style="color: var(--text-dark-muted); font-size: 0.8rem; font-weight: 500;">
            ${origIndex}
          </td>
          <td>
            <a class="problem-title-link" data-slug="${q.slug}" title="${escapeHTML(q.title)}">
              ${escapeHTML(q.title)}
            </a>
            <div class="row-topics">${topicsOf(q).slice(0, 3).map(t => `<span class="row-topic">${t.label}</span>`).join("")}</div>
          </td>
          <td>
            <span class="doc-diff-pill ${diff}"><span class="diff-dot">●</span> ${q.difficulty}</span>
          </td>
          <td>
            <span class="doc-meta-pill">${escapeHTML(company)}</span>
          </td>
          <td style="color: var(--text-dark-muted); font-size: 0.78rem;">
            ${testCount} tests
          </td>
          <td style="text-align: center;">
            <button class="btn-solve-pill" data-slug="${q.slug}">Solve →</button>
          </td>
          <td style="text-align: center;">
            <button class="btn-table-icon btn-table-note ${hasNote ? "has-note" : ""}" data-slug="${q.slug}" title="${hasNote ? "Note: " + escapeHTML(state.userNotes[q.slug].slice(0, 40)) : "Add Note"}">
              ${noteIconHtml}
            </button>
          </td>
          <td style="text-align: center;">
            <button class="btn-table-icon btn-table-star ${isStarred ? "starred" : ""}" data-slug="${q.slug}" title="${isStarred ? "Remove Star" : "Add Star"}">
              ${starIconHtml}
            </button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("tr.home-table-row").forEach(tr => {
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".btn-table-note") || e.target.closest(".btn-table-star")) return;
        const slug = tr.dataset.slug;
        if (slug) {
          state.emit("navigateToQuestion", slug);
        }
      });
    });

    tbody.querySelectorAll(".problem-title-link, .btn-solve-pill").forEach(elBtn => {
      elBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.emit("navigateToQuestion", elBtn.dataset.slug);
      });
    });

    tbody.querySelectorAll(".btn-table-note").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.emit("navigateToQuestion", btn.dataset.slug);
        state.emit("setDocTab", "notes");
      });
    });

    tbody.querySelectorAll(".btn-table-star").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const slug = btn.dataset.slug;
        if (state.starredSlugs.has(slug)) {
          state.starredSlugs.delete(slug);
          showToast("Removed from Starred");
        } else {
          state.starredSlugs.add(slug);
          showToast("Question Starred");
        }
        localStorage.setItem("sqlmaster_starred", JSON.stringify(Array.from(state.starredSlugs)));
        HomePage.updateStarredSidebar();
        HomePage.renderActiveFilterTags();
        HomePage.renderHomeProblemsTable();
      });
    });
  }
};
