/**
 * Practice Workspace Page
 * Coordinates the split-view IDE: question statement, SQL CodeMirror editor,
 * and testcase console drawers.
 */

import { state } from "../../models/state.js";
import { DescriptionComponent } from "../components/description.js";
import { EditorComponent } from "../components/editor.js";
import { TestcaseComponent } from "../components/testcase.js";
import { SplitterComponent } from "../components/splitter.js";

export const PracticePage = {
  render(q) {
    if (!q) {
      PracticePage.renderEmptyState();
      return;
    }
    DescriptionComponent.renderQuestionDetail(q);
    TestcaseComponent.resetConsole();
    DescriptionComponent.loadPersonalNote(q.slug);
    SplitterComponent.syncRailActiveTab();
  },

  renderEmptyState() {
    const descContent = document.querySelector(".doc-tab-content");
    if (descContent) {
      descContent.innerHTML = `
        <div class="practice-empty-state" style="padding: 60px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: var(--accent-blue);">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-2 10h7l-9 10 2-10H4z"/></svg>
          </div>
          <h2 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 8px 0; color: var(--text-dark-main);">Select a Problem to Begin</h2>
          <p style="font-size: 0.88rem; color: var(--text-dark-muted); max-width: 360px; line-height: 1.5; margin: 0 0 24px 0;">
            Choose from 100 curated MySQL 8.0 interview questions from top tech companies.
          </p>
          <button id="btn-empty-open-drawer" class="btn-primary btn-md" style="display: inline-flex; align-items: center; gap: 8px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <span>Open Problem Bank (Alt + Q)</span>
          </button>
        </div>
      `;
      document.getElementById("btn-empty-open-drawer")?.addEventListener("click", () => {
        state.emit("toggleDrawer");
      });
    }
    if (state.editor && !state.editor.getValue()) {
      state.editor.setValue("-- Select a problem from the Problem Bank (Alt + Q) to start practicing.\n\nSELECT 'Welcome to SQLMaster' AS message;\n");
    }
  }
};
