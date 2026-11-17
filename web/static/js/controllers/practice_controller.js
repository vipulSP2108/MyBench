/**
 * Practice Controller
 * Orchestrates SQL execution, test suite validation, submissions, and code starter templates.
 */

import { state, recordAttempt } from "../models/state.js";
import { Engine } from "../models/engine.js";
import { Storage } from "../models/storage.js";
import { EditorComponent } from "../views/components/editor.js";
import { TestcaseComponent } from "../views/components/testcase.js";
import { DescriptionComponent } from "../views/components/description.js";
import { DrawerComponent } from "../views/components/drawer.js";
import { HomePage } from "../views/pages/home_page.js";
import { el, escapeHTML, showToast } from "../utils.js";

export const PracticeController = {
  setStarterTemplate(q) {
    const tableNames = (q.tables || []).map(t => t.table_name).join(", ");
    const firstTbl = (q.tables && q.tables[0]) ? q.tables[0].table_name : "table_name";
    const template = `-- MySQL 8.0 Solution for: ${q.title}
-- Tables available: ${tableNames}

SELECT
  *
FROM ${firstTbl};
`;
    EditorComponent.setQueryCode(template);
  },

  handleEditorRun() {
    PracticeController.runTests();
  },

  handleEditorPreview() {
    PracticeController.quickRunPreview();
  },

  async runTests() {
    if (!state.currentQuestion) return;
    const sql = EditorComponent.getQueryCode().trim();
    if (!sql) {
      alert("Please write a SQL query before submitting.");
      return;
    }

    localStorage.setItem(`sqlmaster_draft_${state.currentQuestion.slug}`, sql);

    const submitBtn = el("btn-submit");
    const spinner = el("btn-submit-spinner");
    const statusBadge = el("console-status-badge");
    const resultsEl = el("console-results");
    const placeholder = el("console-placeholder");

    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = "inline-block";
    if (statusBadge) {
      statusBadge.className = "testcase-status-badge ready";
      statusBadge.textContent = "Running All Tests...";
    }

    try {
      const data = await Engine.executeRunRequest(state.currentQuestion.slug, sql, state.currentQuestion.test_cases);
      state.testResults = data;
      TestcaseComponent.renderTestcasePanel(state.activeTestCaseIndex || 0);

      Storage.recordSubmission();
      recordAttempt(state.currentQuestion.slug, "submit");

      if (data.all_passed) {
        state.solvedSlugs.add(state.currentQuestion.slug);
        state.attemptedSlugs.delete(state.currentQuestion.slug);
        localStorage.setItem("sqlmaster_solved", JSON.stringify(Array.from(state.solvedSlugs)));
        localStorage.setItem("sqlmaster_attempted", JSON.stringify(Array.from(state.attemptedSlugs)));
        state.emit("progressUpdated");
        DescriptionComponent.renderQuestionDetail(state.currentQuestion);
        DrawerComponent.renderQuestionList();
        HomePage.renderHomeProblemsTable();
        
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const ctx = new AudioContext();
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = "sine";
              osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
              gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
              gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.35);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(ctx.currentTime + idx * 0.08);
              osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
            });
          }
        } catch (_) {}

        showToast("🎉 All Test Cases Passed! Question Solved!");
      } else {
        state.emit("progressUpdated");
        DescriptionComponent.renderQuestionDetail(state.currentQuestion);
        DrawerComponent.renderQuestionList();
        HomePage.renderHomeProblemsTable();
        showToast("Test suite finished: Some tests failed (Marked as Attempted)");
      }
    } catch (err) {
      console.error("Test execution failed:", err);
      Storage.recordSubmission();
      if (state.currentQuestion) {
        recordAttempt(state.currentQuestion.slug, "submit");
        state.emit("progressUpdated");
        DescriptionComponent.renderQuestionDetail(state.currentQuestion);
        DrawerComponent.renderQuestionList();
        HomePage.renderHomeProblemsTable();
      }
      if (statusBadge) {
        statusBadge.className = "testcase-status-badge fail";
        statusBadge.textContent = "Error";
      }
      if (resultsEl) {
        if (placeholder) placeholder.style.display = "none";
        resultsEl.style.display = "block";
        resultsEl.innerHTML = `<div class="runtime-error-box">Execution error: ${escapeHTML(err.message)}</div>`;
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.style.display = "none";
    }
  },

  async quickRunPreview() {
    if (!state.currentQuestion) return;
    const sql = EditorComponent.getQueryCode().trim();
    if (!sql) return;

    const placeholder = el("console-placeholder");
    const resultsEl = el("console-results");
    const statusBadge = el("console-status-badge");
    const runBtn = el("btn-quick-run");

    if (placeholder) placeholder.style.display = "none";
    if (resultsEl) resultsEl.style.display = "block";
    if (runBtn) runBtn.disabled = true;

    if (statusBadge) {
      statusBadge.className = "testcase-status-badge ready";
      statusBadge.textContent = "Running Tests...";
    }

    try {
      const data = await Engine.executeRunRequest(state.currentQuestion.slug, sql, state.currentQuestion.test_cases);

      recordAttempt(state.currentQuestion.slug, "run");

      if (data.error) {
        if (statusBadge) {
          statusBadge.className = "testcase-status-badge fail";
          statusBadge.textContent = "Error";
        }
        if (resultsEl) {
          resultsEl.innerHTML = `
            <div class="runtime-error-box">
              <strong>Execution Error:</strong>
              <pre class="error-pre">${escapeHTML(data.error)}</pre>
            </div>
          `;
        }
        state.emit("progressUpdated");
        DrawerComponent.renderQuestionList();
        DescriptionComponent.renderQuestionDetail(state.currentQuestion);
        HomePage.renderHomeProblemsTable();
        return;
      }

      state.testResults = data;
      TestcaseComponent.renderTestcasePanel(0);

      state.emit("progressUpdated");
      DrawerComponent.renderQuestionList();
      DescriptionComponent.renderQuestionDetail(state.currentQuestion);
      HomePage.renderHomeProblemsTable();

      showToast(data.all_passed ? "All test cases passed! (Submit code to mark as Solved)" : "Test run finished: Some tests failed");
    } catch (err) {
      console.error("Run failed:", err);
      if (state.currentQuestion) {
        recordAttempt(state.currentQuestion.slug, "run");
        state.emit("progressUpdated");
        DrawerComponent.renderQuestionList();
        DescriptionComponent.renderQuestionDetail(state.currentQuestion);
        HomePage.renderHomeProblemsTable();
      }
      if (resultsEl) {
        resultsEl.innerHTML = `<div class="runtime-error-box">Run failed: ${escapeHTML(err.message)}</div>`;
      }
    } finally {
      if (runBtn) runBtn.disabled = false;
    }
  }
};
