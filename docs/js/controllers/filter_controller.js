/**
 * Filter & Search Controller
 * Handles question filtering, sorting, and the advanced rule builder.
 */

import { state, DIFFICULTY_ORDER, isQuestionSolved, isQuestionAttempted } from "../models/state.js";
import { DrawerComponent } from "../views/components/drawer.js";
import { el, escapeHTML } from "../utils.js";

export const FilterController = {
  matchesAdvRule(q, rule) {
    if (!rule || !rule.values || rule.values.length === 0) return true;

    const isPositive = (rule.op === "is");
    const values = rule.values.map(v => String(v).toLowerCase());

    if (rule.field === "status") {
      const isSolved = isQuestionSolved(q.slug);
      const isAttempted = isQuestionAttempted(q.slug);
      const isStarred = state.starredSlugs.has(q.slug);
      const hasNote = Boolean(state.userNotes[q.slug]);
      const isUnsolved = !isSolved && !isAttempted;

      const hasMatch = values.some(v => {
        if (v === "starred") return isStarred;
        if (v === "notes" || v === "has_notes") return hasNote;
        if (v === "solved") return isSolved;
        if (v === "attempted") return isAttempted;
        if (v === "unsolved" || v === "todo") return isUnsolved;
        return false;
      });
      return isPositive ? hasMatch : !hasMatch;
    }

    if (rule.field === "starred") {
      const isStarred = state.starredSlugs.has(q.slug);
      const hasMatch = values.some(v => {
        if (v === "starred" || v === "yes" || v === "true") return isStarred;
        if (v === "unstarred" || v === "no" || v === "false") return !isStarred;
        return false;
      });
      return isPositive ? hasMatch : !hasMatch;
    }

    if (rule.field === "notes") {
      const hasNote = Boolean(state.userNotes[q.slug]);
      const hasMatch = values.some(v => {
        if (v === "has_notes" || v === "yes" || v === "true") return hasNote;
        if (v === "no_notes" || v === "no" || v === "false") return !hasNote;
        return false;
      });
      return isPositive ? hasMatch : !hasMatch;
    }

    if (rule.field === "difficulty") {
      const qDiff = (q.difficulty || "").toLowerCase();
      const hasMatch = values.includes(qDiff);
      return isPositive ? hasMatch : !hasMatch;
    }

    if (rule.field === "company") {
      const qComp = (q.company || "General").toLowerCase();
      const hasMatch = values.some(v => v === qComp);
      return isPositive ? hasMatch : !hasMatch;
    }

    if (rule.field === "tags") {
      const qTags = (q.tags || []).map(t => String(t).toLowerCase());
      const hasMatch = values.some(v => qTags.includes(v));
      return isPositive ? hasMatch : !hasMatch;
    }

    return true;
  },

  evaluateQuestionRules(q, rules, matchMode = "all") {
    const activeRules = (rules || []).filter(r => r.values && r.values.length > 0);
    if (activeRules.length === 0) return true;

    if (matchMode === "any") {
      return activeRules.some(r => FilterController.matchesAdvRule(q, r));
    }
    return activeRules.every(r => FilterController.matchesAdvRule(q, r));
  },

  filterAndSortQuestions() {
    const query = state.searchQuery.toLowerCase().trim();

    let list = state.questions.filter(q => {
      let matchesDiff = true;
      if (state.selectedDifficulty && state.selectedDifficulty !== "all") {
        if (state.selectedDifficulty === "starred") {
          matchesDiff = state.starredSlugs.has(q.slug);
        } else if (state.selectedDifficulty === "attempted") {
          matchesDiff = isQuestionAttempted(q.slug);
        } else if (state.selectedDifficulty === "solved") {
          matchesDiff = isQuestionSolved(q.slug);
        } else if (state.selectedDifficulty === "unsolved") {
          matchesDiff = !isQuestionSolved(q.slug) && !isQuestionAttempted(q.slug);
        } else {
          matchesDiff = q.difficulty.toLowerCase() === state.selectedDifficulty;
        }
      }

      const matchesCompany = state.selectedCompany === "all" || q.company === state.selectedCompany;
      const matchesSearch = !query ||
        q.title.toLowerCase().includes(query) ||
        q.slug.toLowerCase().includes(query) ||
        (q.company && q.company.toLowerCase().includes(query)) ||
        (q.tags && q.tags.some(t => t.toLowerCase().includes(query)));

      const matchesRules = FilterController.evaluateQuestionRules(q, state.advRules, state.advMatchMode);

      return matchesDiff && matchesCompany && matchesSearch && matchesRules;
    });

    const sortKey = state.selectedSort;
    list.sort((a, b) => {
      if (sortKey === "num-desc") {
        return (state.questions.indexOf(b) - state.questions.indexOf(a));
      }
      if (sortKey === "diff-asc") {
        const dA = DIFFICULTY_ORDER[a.difficulty.toLowerCase()] || 2;
        const dB = DIFFICULTY_ORDER[b.difficulty.toLowerCase()] || 2;
        return dA - dB || a.title.localeCompare(b.title);
      }
      if (sortKey === "diff-desc") {
        const dA = DIFFICULTY_ORDER[a.difficulty.toLowerCase()] || 2;
        const dB = DIFFICULTY_ORDER[b.difficulty.toLowerCase()] || 2;
        return dB - dA || a.title.localeCompare(b.title);
      }
      if (sortKey === "title-asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortKey === "title-desc") {
        return b.title.localeCompare(a.title);
      }
      if (sortKey === "company-asc") {
        const cA = a.company || "ZZZ";
        const cB = b.company || "ZZZ";
        return cA.localeCompare(cB) || a.title.localeCompare(b.title);
      }
      if (sortKey === "tests-desc") {
        const tA = (a.test_case_count !== undefined) ? a.test_case_count : (a.test_cases ? a.test_cases.length : 0);
        const tB = (b.test_case_count !== undefined) ? b.test_case_count : (b.test_cases ? b.test_cases.length : 0);
        return tB - tA || a.title.localeCompare(b.title);
      }
      if (sortKey === "status") {
        const getStatusRank = (slug) => {
          if (isQuestionSolved(slug)) return 0;
          if (isQuestionAttempted(slug)) return 1;
          return 2;
        };
        return getStatusRank(a.slug) - getStatusRank(b.slug) || a.title.localeCompare(b.title);
      }
      if (sortKey === "unsolved-first") {
        const getUnsolvedRank = (slug) => {
          if (!isQuestionSolved(slug) && !isQuestionAttempted(slug)) return 0;
          if (isQuestionAttempted(slug)) return 1;
          return 2;
        };
        return getUnsolvedRank(a.slug) - getUnsolvedRank(b.slug) || a.title.localeCompare(b.title);
      }
      if (sortKey === "starred") {
        const sA = state.starredSlugs.has(a.slug) ? 0 : 1;
        const sB = state.starredSlugs.has(b.slug) ? 0 : 1;
        return sA - sB || a.title.localeCompare(b.title);
      }
      return (state.questions.indexOf(a) - state.questions.indexOf(b));
    });

    state.filteredQuestions = list;
    const countBadge = el("question-count-badge");
    if (countBadge) countBadge.textContent = `${list.length}/${state.questions.length}`;

    DrawerComponent.updateDrawerStats(list);
    FilterController.saveAdvRulesState();
    DrawerComponent.renderQuestionList();
  },

  saveAdvRulesState() {
    try {
      localStorage.setItem("sqlmaster_adv_rules", JSON.stringify(state.advRules));
      localStorage.setItem("sqlmaster_adv_match_mode", state.advMatchMode);
    } catch (e) {
      console.warn("Failed to persist adv rules:", e);
    }
  },

  loadSavedAdvRules() {
    try {
      const savedRules = localStorage.getItem("sqlmaster_adv_rules");
      if (savedRules) {
        const parsed = JSON.parse(savedRules);
        if (Array.isArray(parsed)) {
          state.advRules = parsed;
        }
      }
      const savedMatch = localStorage.getItem("sqlmaster_adv_match_mode");
      if (savedMatch === "all" || savedMatch === "any") {
        state.advMatchMode = savedMatch;
      }
    } catch (e) {
      console.warn("Failed to restore adv rules from storage:", e);
    }
  },

  applyAdvRulesMinimizedState(minimized) {
    state.advRulesMinimized = minimized;
    localStorage.setItem("sqlmaster_adv_rules_minimized", String(minimized));
    const panel = el("drawer-adv-filter-panel");
    const icon = el("icon-minimize-adv-rules");
    const btn = el("btn-minimize-adv-rules");

    if (panel) panel.classList.toggle("minimized", minimized);
    if (icon) {
      icon.innerHTML = minimized
        ? `<polyline points="6 9 12 15 18 9"/>`
        : `<polyline points="18 15 12 9 6 15"/>`;
    }
    if (btn) {
      btn.title = minimized ? "Expand filter rules panel" : "Minimize filter rules panel";
    }
  },

  toggleAdvRulesMinimized() {
    FilterController.applyAdvRulesMinimizedState(!state.advRulesMinimized);
  },

  getFieldOptions(field) {
    if (field === "status") {
      return [
        { val: "solved", label: "Solved", color: "#10b981" },
        { val: "attempted", label: "Attempted", color: "#f59e0b" },
        { val: "unsolved", label: "Todo / Unsolved", color: "#64748b" },
        { val: "starred", label: "★ Starred", color: "#eab308" },
        { val: "notes", label: "✎ Has Notes", color: "#38bdf8" }
      ];
    }
    if (field === "starred") {
      return [
        { val: "starred", label: "★ Starred", color: "#eab308" },
        { val: "unstarred", label: "☆ Without Stars", color: "#64748b" }
      ];
    }
    if (field === "notes") {
      return [
        { val: "has_notes", label: "✎ With Notes", color: "#38bdf8" },
        { val: "no_notes", label: "Without Notes", color: "#64748b" }
      ];
    }
    if (field === "difficulty") {
      return [
        { val: "easy", label: "Easy", color: "#059669" },
        { val: "medium", label: "Med.", color: "#d97706" },
        { val: "hard", label: "Hard", color: "#e11d48" }
      ];
    }
    if (field === "company") {
      const comps = Array.from(new Set(state.questions.map(q => q.company).filter(Boolean))).sort();
      return comps.map(c => ({ val: c.toLowerCase(), label: c }));
    }
    if (field === "tags") {
      const allTags = new Set();
      state.questions.forEach(q => (q.tags || []).forEach(t => allTags.add(t)));
      return Array.from(allTags).sort().map(t => ({ val: t.toLowerCase(), label: t }));
    }
    return [];
  },

  renderAdvFilterRules() {
    const container = el("adv-rules-list");
    if (!container) return;

    container.innerHTML = "";

    if (state.advRules.length === 0) {
      container.innerHTML = `<div style="font-size: 0.74rem; color: var(--text-dark-muted); text-align: center; padding: 10px 4px;">No active rules. Click "Add Filter Rule" to construct custom query conditions.</div>`;
      return;
    }

    state.advRules.forEach((rule, idx) => {
      const row = document.createElement("div");
      row.className = "adv-rule-row";
      row.dataset.ruleId = rule.id;

      const fieldIcon = rule.field === "status"
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
        : rule.field === "starred"
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
        : rule.field === "notes"
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`
        : rule.field === "difficulty"
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`
        : rule.field === "tags"
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>`;

      let valuesText = `<span style="color: var(--text-dark-muted);">Select values...</span>`;
      if (rule.field === "starred" && (!rule.values || rule.values.length === 0)) {
        rule.values = ["starred"];
      } else if (rule.field === "notes" && (!rule.values || rule.values.length === 0)) {
        rule.values = ["has_notes"];
      }

      if (rule.values && rule.values.length > 0) {
        const opts = FilterController.getFieldOptions(rule.field);
        const firstOpt = opts.find(o => o.val === rule.values[0]) || { label: rule.values[0] };
        const extraCount = rule.values.length - 1;
        valuesText = `
          <span class="adv-val-chip-tag">${escapeHTML(firstOpt.label)}</span>
          ${extraCount > 0 ? `<span class="adv-val-count-badge">+${extraCount}</span>` : ""}
        `;
      }

      const isSimpleBinary = (rule.field === "starred" || rule.field === "notes");

      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:4px;">
          <span style="color: var(--text-dark-muted); display:inline-flex;">${fieldIcon}</span>
          <select class="adv-rule-field-select" data-rule-idx="${idx}" title="Select filter attribute">
            <option value="status" ${rule.field === "status" ? "selected" : ""}>Status</option>
            <option value="starred" ${rule.field === "starred" ? "selected" : ""}>Starred</option>
            <option value="notes" ${rule.field === "notes" ? "selected" : ""}>Notes</option>
            <option value="difficulty" ${rule.field === "difficulty" ? "selected" : ""}>Difficulty</option>
            <option value="company" ${rule.field === "company" ? "selected" : ""}>Company</option>
            <option value="tags" ${rule.field === "tags" ? "selected" : ""}>Topics / Tags</option>
          </select>
        </div>

        ${isSimpleBinary ? "" : `
        <select class="adv-rule-op-select" data-rule-idx="${idx}" title="Condition">
          <option value="is" ${rule.op === "is" ? "selected" : ""}>is</option>
          <option value="is_not" ${rule.op === "is_not" ? "selected" : ""}>is not</option>
        </select>
        `}

        <div class="adv-rule-val-wrap">
          <button type="button" class="adv-rule-val-pill-btn" data-rule-idx="${idx}" title="Choose values">
            <span style="display:flex; align-items:center; gap:4px; overflow:hidden;">${valuesText}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        <button type="button" class="adv-rule-remove-btn" data-rule-idx="${idx}" title="Remove rule">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      container.appendChild(row);
    });

    container.querySelectorAll(".adv-rule-field-select").forEach(sel => {
      sel.addEventListener("change", (e) => {
        const idx = parseInt(e.target.dataset.ruleIdx, 10);
        const newField = e.target.value;
        state.advRules[idx].field = newField;
        if (newField === "starred") {
          state.advRules[idx].values = ["starred"];
        } else if (newField === "notes") {
          state.advRules[idx].values = ["has_notes"];
        } else {
          state.advRules[idx].values = [];
        }
        FilterController.renderAdvFilterRules();
        FilterController.filterAndSortQuestions();
      });
    });

    container.querySelectorAll(".adv-rule-op-select").forEach(sel => {
      sel.addEventListener("change", (e) => {
        const idx = parseInt(e.target.dataset.ruleIdx, 10);
        state.advRules[idx].op = e.target.value;
        FilterController.filterAndSortQuestions();
      });
    });

    container.querySelectorAll(".adv-rule-remove-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.ruleIdx, 10);
        state.advRules.splice(idx, 1);
        FilterController.renderAdvFilterRules();
        FilterController.filterAndSortQuestions();
      });
    });

    container.querySelectorAll(".adv-rule-val-pill-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.ruleIdx, 10);
        FilterController.openRuleValuesPopover(btn, state.advRules[idx]);
      });
    });
  },

  openRuleValuesPopover(anchorEl, rule) {
    const existing = document.getElementById("active-rule-values-popover");
    if (existing) existing.remove();

    const options = FilterController.getFieldOptions(rule.field);
    const popover = document.createElement("div");
    popover.id = "active-rule-values-popover";
    popover.className = "filter-popover-menu";
    popover.style.position = "absolute";
    popover.style.zIndex = "2000";
    popover.style.maxHeight = "240px";
    popover.style.overflowY = "auto";
    popover.style.width = "200px";

    const rect = anchorEl.getBoundingClientRect();
    popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
    popover.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 210)}px`;

    popover.innerHTML = `
      <div style="padding: 4px 10px 6px; font-size: 0.70rem; font-weight: 700; color: var(--text-dark-muted); text-transform: uppercase; border-bottom: 1px solid var(--border-light);">
        Select ${escapeHTML(rule.field)}
      </div>
      <div class="popover-opts-scroll">
        ${options.map(opt => {
          const isChecked = rule.values.includes(opt.val);
          return `
            <label class="filter-menu-opt" style="padding: 6px 12px; font-size: 0.78rem;">
              <input type="checkbox" class="rule-val-cb" value="${escapeHTML(opt.val)}" ${isChecked ? "checked" : ""} />
              <span style="${opt.color ? `color: ${opt.color}; font-weight: 600;` : ""}">${escapeHTML(opt.label)}</span>
              ${isChecked ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-left:auto;"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
            </label>
          `;
        }).join("")}
      </div>
    `;

    document.body.appendChild(popover);

    const isSimpleBinary = (rule.field === "starred" || rule.field === "notes");

    popover.querySelectorAll(".rule-val-cb").forEach(cb => {
      cb.addEventListener("change", () => {
        const val = cb.value;
        if (isSimpleBinary) {
          if (cb.checked) {
            rule.values = [val];
          } else {
            rule.values = [];
          }
          FilterController.renderAdvFilterRules();
          FilterController.filterAndSortQuestions();
          popover.remove();
          document.removeEventListener("click", onDocClick);
          return;
        }

        if (cb.checked) {
          if (!rule.values.includes(val)) rule.values.push(val);
        } else {
          rule.values = rule.values.filter(v => v !== val);
        }
        FilterController.renderAdvFilterRules();
        FilterController.filterAndSortQuestions();
      });
    });

    const onDocClick = (e) => {
      if (!popover.contains(e.target) && !anchorEl.contains(e.target)) {
        popover.remove();
        document.removeEventListener("click", onDocClick);
      }
    };
    setTimeout(() => document.addEventListener("click", onDocClick), 50);
  }
};
