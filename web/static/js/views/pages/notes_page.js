/**
 * Notes Hub Page
 * Displays a searchable grid of all personal notes recorded by the user across questions.
 */

import { state } from "../../models/state.js";
import { DescriptionComponent } from "../components/description.js";
import { el, escapeHTML } from "../../utils.js";

export const NotesPage = {
  renderNotesHub() {
    const query = (el("notes-search-input")?.value || "").toLowerCase().trim();
    const notedSlugs = Object.keys(state.userNotes);
    const hubGrid = el("notes-hub-grid");
    if (!hubGrid) return;

    const matched = notedSlugs.filter(slug => {
      const q = state.questions.find(item => item.slug === slug);
      const note = state.userNotes[slug].toLowerCase();
      const title = q ? q.title.toLowerCase() : "";
      const company = q && q.company ? q.company.toLowerCase() : "";
      return !query || note.includes(query) || title.includes(query) || company.includes(query);
    });

    if (matched.length === 0) {
      hubGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-dark-muted);">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 12px auto; display: block; opacity: 0.5;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <h3 style="font-size: 1.1rem; color: var(--text-dark-main);">${notedSlugs.length === 0 ? "No Personal Notes Recorded Yet" : "No Notes Match Your Search"}</h3>
          <p style="font-size: 0.88rem; margin-top: 8px;">
            ${notedSlugs.length === 0 ? "Add your thoughts, edge case notes, or approaches directly in the problem panel during practice!" : "Try clearing your search query."}
          </p>
        </div>
      `;
      return;
    }

    hubGrid.innerHTML = matched.map(slug => {
      const q = state.questions.find(item => item.slug === slug);
      const title = q ? q.title : slug;
      const diff = q ? q.difficulty.toLowerCase() : "medium";
      const company = q ? (q.company || "General") : "General";
      const note = state.userNotes[slug];

      return `
        <div class="note-card" style="background: var(--bg-white); border: 1px solid var(--border-light); border-radius: 10px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px;">
              <h4 style="font-size: 0.94rem; font-weight: 700; color: var(--text-dark-main);">${escapeHTML(title)}</h4>
              <span class="doc-diff-pill ${diff}">${q ? q.difficulty : "Med"}</span>
            </div>
            <div style="font-size: 0.76rem; color: var(--text-dark-muted); margin-bottom: 12px;">${escapeHTML(company)}</div>
            <p style="font-size: 0.86rem; color: var(--text-dark-secondary); white-space: pre-wrap; line-height: 1.5; background: var(--bg-page); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light); max-height: 140px; overflow-y: auto;">${escapeHTML(note)}</p>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
            <button class="btn-sm-clean btn-jump-note" data-slug="${slug}">Practice →</button>
            <button class="btn-sm-clean text-danger btn-delete-note-hub" data-slug="${slug}" title="Delete note">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join("");

    hubGrid.querySelectorAll(".btn-jump-note").forEach(btn => {
      btn.addEventListener("click", () => {
        state.emit("navigateToQuestion", btn.dataset.slug);
      });
    });

    hubGrid.querySelectorAll(".btn-delete-note-hub").forEach(btn => {
      btn.addEventListener("click", () => {
        DescriptionComponent.deletePersonalNote(btn.dataset.slug);
      });
    });
  }
};
