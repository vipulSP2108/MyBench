/**
 * Problem Drawer Component
 * Handles the slide-out question bank drawer, virtualized/scrollable problem list, and drawer stats.
 */

import { state, isQuestionSolved, isQuestionAttempted } from "../../models/state.js";
import { el, escapeHTML } from "../../utils.js";

export const DrawerComponent = {
  openDrawer() {
    state.drawerOpen = true;
    const drawer = el("problem-drawer");
    const backdrop = el("drawer-backdrop");
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    const searchInput = el("search-input");
    if (searchInput) setTimeout(() => searchInput.focus(), 150);
  },

  closeDrawer() {
    state.drawerOpen = false;
    const drawer = el("problem-drawer");
    const backdrop = el("drawer-backdrop");
    if (drawer) drawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
  },

  toggleDrawer() {
    if (state.drawerOpen) {
      DrawerComponent.closeDrawer();
    } else {
      DrawerComponent.openDrawer();
    }
  },

  updateDrawerStats(filteredList) {
    const list = filteredList || state.filteredQuestions || [];
    const totalInScope = list.length;

    let solvedInScope = 0;
    let attemptedInScope = 0;
    let unsolvedInScope = 0;

    list.forEach(q => {
      if (isQuestionSolved(q.slug)) {
        solvedInScope++;
      } else if (isQuestionAttempted(q.slug)) {
        attemptedInScope++;
      } else {
        unsolvedInScope++;
      }
    });

    const solvedCountEl = el("dstat-solved-count");
    const attemptedCountEl = el("dstat-attempted-count");
    const unsolvedCountEl = el("dstat-unsolved-count");

    if (solvedCountEl) solvedCountEl.textContent = solvedInScope;
    if (attemptedCountEl) attemptedCountEl.textContent = attemptedInScope;
    if (unsolvedCountEl) unsolvedCountEl.textContent = unsolvedInScope;

    const solvedPct = totalInScope > 0 ? (solvedInScope / totalInScope) * 100 : 0;
    const attemptedPct = totalInScope > 0 ? (attemptedInScope / totalInScope) * 100 : 0;

    const progSolved = el("dstat-progress-solved");
    const progAttempted = el("dstat-progress-attempted");

    if (progSolved) progSolved.style.width = `${solvedPct}%`;
    if (progAttempted) progAttempted.style.width = `${attemptedPct}%`;
  },

  renderQuestionList() {
    const qListEl = el("question-list");
    if (!qListEl) return;
    qListEl.innerHTML = "";

    if (state.filteredQuestions.length === 0) {
      qListEl.innerHTML = `<div class="empty-list-notice" style="padding: 20px; text-align: center; color: var(--text-dark-muted); font-size: 0.85rem;">No matching questions found.</div>`;
      return;
    }

    state.filteredQuestions.forEach((q) => {
      const item = document.createElement("div");
      const isActive = state.currentQuestion && state.currentQuestion.slug === q.slug;
      const isSolved = isQuestionSolved(q.slug);
      const isAttempted = isQuestionAttempted(q.slug);
      const isStarred = state.starredSlugs.has(q.slug);
      const hasNote = Boolean(state.userNotes[q.slug]);

      item.className = `drawer-q-item ${isActive ? "active" : ""}`;

      const qNum = state.questions.findIndex(item => item.slug === q.slug) + 1;

      const statusIcon = isSolved
        ? `<span class="solved-icon" title="Solved"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`
        : isAttempted
        ? `<span class="attempted-icon" title="Attempted"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"/></svg></span>`
        : "";

      item.innerHTML = `
        <div class="drawer-q-num">${qNum}.</div>
        <div class="drawer-q-main">
          <div class="drawer-q-title-row">
            ${statusIcon}
            <span class="drawer-q-title" title="${escapeHTML(q.title)}">${escapeHTML(q.title)}</span>
            ${isStarred ? `<span class="drawer-star-icon" title="Starred"><svg width="13" height="13" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>` : ""}
            ${hasNote ? `<span class="drawer-note-icon" title="Has Personal Note"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>` : ""}
          </div>
          <div class="drawer-q-meta">
            <span>${q.company || "General"}</span>
            <span>· ${q.test_case_count} tests</span>
          </div>
        </div>
        <span class="doc-diff-pill ${q.difficulty.toLowerCase()}"><span class="diff-dot">●</span> ${q.difficulty}</span>
      `;

      item.addEventListener("click", () => {
        state.emit("navigateToQuestion", q.slug);
        DrawerComponent.closeDrawer();
      });

      qListEl.appendChild(item);
    });
  }
};
