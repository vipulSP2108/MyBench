/**
 * Problem Description Component
 * Renders problem statement, continuous schema & sample tables, hints accordion,
 * editorial solution, and personal notes subpage.
 */

import { state, isQuestionSolved, isQuestionAttempted } from "../../models/state.js";
import { el, escapeHTML, showToast } from "../../utils.js";

export const DescriptionComponent = {
  formatTextToParagraphs(text) {
    if (!text) return "";
    const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
    return paragraphs.map(p => {
      const formatted = escapeHTML(p.trim()).replace(/`([^`]+)`/g, "<code>$1</code>");
      return `<p class="problem-p">${formatted}</p>`;
    }).join("");
  },

  createTableHTML(rows) {
    if (!rows || rows.length === 0) {
      return `<div style="padding: 10px; color: var(--text-dark-muted); font-size: 0.8rem; font-style: italic;">(0 rows / empty result set)</div>`;
    }

    const cols = Object.keys(rows[0]);
    let html = `<table class="data-table"><thead><tr>`;
    cols.forEach(c => html += `<th>${escapeHTML(c)}</th>`);
    html += `</tr></thead><tbody>`;

    rows.forEach(r => {
      html += `<tr>`;
      cols.forEach(c => {
        const val = r[c];
        const isNum = typeof val === "number";
        let displayVal;
        if (val === null || val === undefined) {
          displayVal = `<span class="null-val">NULL</span>`;
        } else {
          displayVal = escapeHTML(String(val));
        }
        html += `<td class="${isNum ? "num" : ""}">${displayVal}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    return html;
  },

  renderContinuousTables(q) {
    const container = el("problem-tables-container");
    if (!container) return;
    container.innerHTML = "";

    const tables = q.tables || [];

    tables.forEach((tbl) => {
      const tableBlock = document.createElement("div");
      tableBlock.className = "table-block";

      const sampleRows = (q.sample_data && q.sample_data[tbl.table_name]) || [];

      tableBlock.innerHTML = `
        <h3 class="flow-heading flow-header-row">
          <span class="flow-label">Table:</span>
          <span class="table-badge">
            <svg class="table-badge-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>
            </svg>
            <code class="table-name-code">${escapeHTML(tbl.table_name)}</code>
          </span>
        </h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 50%;">Column Name</th>
                <th style="width: 50%;">Type</th>
              </tr>
            </thead>
            <tbody>
              ${tbl.columns.map(c => `
                <tr>
                  <td><strong class="col-name">${escapeHTML(c.column_name)}</strong></td>
                  <td><span class="data-type-label">${escapeHTML(c.data_type)}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <h4 class="flow-subheading flow-header-row sub">
          <span class="flow-label">Example Input:</span>
          <span class="table-badge subtle">
            <svg class="table-badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>
            </svg>
            <code class="table-name-code">${escapeHTML(tbl.table_name)}</code>
          </span>
        </h4>
        <div class="table-container">
          ${DescriptionComponent.createTableHTML(sampleRows)}
        </div>
      `;

      container.appendChild(tableBlock);
    });
  },

  renderQuestionDetail(q) {
    const qNum = state.questions.findIndex(item => item.slug === q.slug) + 1;
    const total = state.questions.length || 100;

    const titleEl = el("problem-title");
    if (titleEl) {
      titleEl.textContent = `${qNum ? qNum + ". " : ""}${q.title}`;
    }

    const bottomCounter = el("bottom-q-counter");
    if (bottomCounter) {
      bottomCounter.textContent = `${qNum || 1} / ${total}`;
    }

    const isSolved = isQuestionSolved(q.slug);
    const isAttempted = isQuestionAttempted(q.slug);
    const statusBadge = el("problem-status-badge");
    const statusText = el("problem-status-text");
    if (statusBadge && statusText) {
      if (isSolved) {
        statusBadge.className = "status-indicator-badge solved";
        statusText.textContent = "Solved";
      } else if (isAttempted) {
        statusBadge.className = "status-indicator-badge attempted";
        statusText.textContent = "Attempted";
      } else {
        statusBadge.className = "status-indicator-badge";
        statusText.textContent = "Not Attempted";
      }
    }

    const diffPill = el("problem-diff-pill");
    if (diffPill) {
      diffPill.className = `doc-diff-pill ${q.difficulty.toLowerCase()}`;
      diffPill.innerHTML = `<span class="diff-dot">●</span> ${escapeHTML(q.difficulty)}`;
    }

    const editorDiffBadge = el("editor-diff-badge");
    const editorDiffDiv = el("editor-diff-divider");
    if (editorDiffBadge) {
      editorDiffBadge.innerHTML = `<span class="diff-dot">●</span> ${escapeHTML(q.difficulty)}`;
      editorDiffBadge.className = `editor-meta-badge diff-${q.difficulty.toLowerCase()}`;
      editorDiffBadge.style.display = "inline-flex";
      if (editorDiffDiv) editorDiffDiv.style.display = "inline";
    }

    const compPill = el("problem-company-pill");
    if (compPill) {
      compPill.textContent = q.company || "General";
    }

    const isStarred = state.starredSlugs.has(q.slug);
    const starBtn = el("btn-star-question");
    const bottomStar = el("btn-bottom-star");
    const starSvgFilled = `<svg width="15" height="15" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    const starSvgOutline = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    if (starBtn) {
      starBtn.className = `panel-icon-btn ${isStarred ? "starred" : ""}`;
      starBtn.innerHTML = `<span>${isStarred ? starSvgFilled : starSvgOutline}</span>`;
      starBtn.title = isStarred ? "Starred (Click to remove)" : "Star / Bookmark Question";
    }
    if (bottomStar) {
      bottomStar.innerHTML = isStarred ? starSvgFilled : starSvgOutline;
    }

    const descEl = el("problem-description");
    if (descEl) {
      descEl.innerHTML = DescriptionComponent.formatTextToParagraphs(q.question);
    }

    DescriptionComponent.renderContinuousTables(q);

    const sampleOutputEl = el("problem-sample-output");
    if (sampleOutputEl) {
      sampleOutputEl.innerHTML = DescriptionComponent.createTableHTML(q.expected_output);
    }

    const notesSec = el("notes-section");
    const probNotes = el("problem-notes");
    if (notesSec && probNotes) {
      if (q.notes && q.notes.length > 0) {
        notesSec.style.display = "block";
        probNotes.innerHTML = q.notes.map(n => `
          <div class="note-item">
            <span class="note-bullet">•</span>
            <span>${escapeHTML(n)}</span>
          </div>
        `).join("");
      } else {
        notesSec.style.display = "none";
      }
    }

    const refCode = el("reference-sql-code");
    if (refCode) {
      refCode.textContent = q.reference_sql || "-- Solution not available.";
    }

    const editorialApproach = el("editorial-approach-content");
    if (editorialApproach) {
      const tableNames = (q.tables || []).map(t => `<span class="table-badge subtle" style="padding: 1px 7px; font-size: 0.82em;"><code class="table-name-code">${escapeHTML(t.table_name)}</code></span>`).join(", ");
      let notesSummary = "";
      if (q.notes && q.notes.length > 0) {
        notesSummary = `
          <div style="margin-top: 14px; padding: 12px 16px; background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; border-radius: 4px;">
            <strong>Problem Notes & Assumptions:</strong>
            <ul style="margin: 6px 0 0 18px; padding: 0;">
              ${q.notes.map(n => `<li>${escapeHTML(n)}</li>`).join("")}
            </ul>
          </div>
        `;
      }
      editorialApproach.innerHTML = `
        <p>To solve <strong>${escapeHTML(q.title)}</strong>, we analyze the required target entities across ${tableNames || "the schema"}.</p>
        <p>Focus on applying the necessary joins or aggregations, verify handling of edge cases, and inspect the verified MySQL 8.0 query below:</p>
        ${notesSummary}
      `;
    }
  },

  setDocTab(tabName) {
    state.activeDocTab = tabName;

    const descTab = el("tab-doc-desc");
    const editTab = el("tab-doc-editorial");
    const notesTab = el("tab-doc-notes");

    if (descTab) descTab.classList.toggle("active", tabName === "desc");
    if (editTab) editTab.classList.toggle("active", tabName === "editorial");
    if (notesTab) notesTab.classList.toggle("active", tabName === "notes");

    const paneDesc = el("subpage-desc");
    const paneEditorial = el("subpage-editorial");
    const paneNotes = el("subpage-notes");

    if (paneDesc) {
      paneDesc.style.display = tabName === "desc" ? "flex" : "none";
      if (tabName === "desc") paneDesc.scrollTop = 0;
    }
    if (paneEditorial) {
      paneEditorial.style.display = tabName === "editorial" ? "flex" : "none";
      if (tabName === "editorial") paneEditorial.scrollTop = 0;
    }
    if (paneNotes) {
      paneNotes.style.display = tabName === "notes" ? "flex" : "none";
      if (tabName === "notes") {
        const txt = el("user-note-input");
        if (txt) txt.focus();
      }
    }

    state.emit("syncRailTab");
  },

  loadPersonalNote(slug) {
    const note = state.userNotes[slug] || "";
    const input = el("user-note-input");
    const delBtn = el("btn-delete-note");
    const saveStatus = el("note-save-status");

    if (input) input.value = note;
    if (delBtn) delBtn.style.display = note ? "inline-flex" : "none";
    if (saveStatus) saveStatus.textContent = "";
  },

  savePersonalNote() {
    if (!state.currentQuestion) return;
    const slug = state.currentQuestion.slug;
    const input = el("user-note-input");
    const delBtn = el("btn-delete-note");
    const saveStatus = el("note-save-status");
    if (!input) return;

    const note = input.value.trim();

    if (note) {
      state.userNotes[slug] = note;
      if (delBtn) delBtn.style.display = "inline-flex";
      if (saveStatus) saveStatus.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> <span>Saved</span>`;
      showToast("Personal note saved");
    } else {
      delete state.userNotes[slug];
      if (delBtn) delBtn.style.display = "none";
      if (saveStatus) saveStatus.textContent = "";
    }

    localStorage.setItem("sqlmaster_user_notes", JSON.stringify(state.userNotes));
    setTimeout(() => { if (saveStatus) saveStatus.textContent = ""; }, 2000);
    DescriptionComponent.updateNotesCountBadge();
    state.emit("notesUpdated");
  },

  deletePersonalNote(slug) {
    slug = slug || (state.currentQuestion ? state.currentQuestion.slug : null);
    if (!slug) return;

    if (confirm("Delete this personal note?")) {
      delete state.userNotes[slug];
      localStorage.setItem("sqlmaster_user_notes", JSON.stringify(state.userNotes));

      if (state.currentQuestion && state.currentQuestion.slug === slug) {
        const input = el("user-note-input");
        const delBtn = el("btn-delete-note");
        const saveStatus = el("note-save-status");
        if (input) input.value = "";
        if (delBtn) delBtn.style.display = "none";
        if (saveStatus) {
          saveStatus.textContent = "Deleted";
          setTimeout(() => { if (saveStatus) saveStatus.textContent = ""; }, 2000);
        }
      }
      DescriptionComponent.updateNotesCountBadge();
      state.emit("notesUpdated");
      showToast("Note deleted");
    }
  },

  updateNotesCountBadge() {
    const count = Object.keys(state.userNotes).length;
    const badge = el("notes-badge-count");
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "inline-flex" : "none";
    }
  }
};
