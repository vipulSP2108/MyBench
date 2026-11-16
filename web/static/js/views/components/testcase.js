/**
 * Testcase Drawer & Console Component
 * Displays Case 1, 2, ... tabs, table/JSON inputs, expected vs actual diff tables, and custom testcase creation.
 */

import { state } from "../../models/state.js";
import { Engine } from "../../models/engine.js";
import { el, escapeHTML, showToast } from "../../utils.js";

export const TestcaseComponent = {
  formatTestCaseInputLines(tc) {
    const inputTables = (tc && (tc.input_data || tc.tables)) || 
                        (state.currentQuestion && state.currentQuestion.sample_data) || {};
    
    if (Object.keys(inputTables).length === 0) {
      return `<div class="tc-line-row"><span class="tc-line-num">1</span><span class="tc-line-content">No input tables defined.</span></div>`;
    }
    let lineIdx = 1;
    let html = "";
    for (const [tblName, rows] of Object.entries(inputTables)) {
      html += `
        <div class="tc-line-row tc-table-header-row" style="color: var(--accent-cyan); font-weight: 600; margin-top: ${lineIdx > 1 ? '8px' : '0'}; margin-bottom: 2px;">
          <span class="tc-line-num">${lineIdx++}</span>
          <span class="tc-line-content">-- Table: ${escapeHTML(tblName)}</span>
        </div>
      `;
      if (rows && rows.length > 0) {
        const cols = Object.keys(rows[0]);
        html += `
          <div class="tc-line-row tc-cols-header-row" style="opacity: 0.8; font-weight: 600;">
            <span class="tc-line-num">${lineIdx++}</span>
            <span class="tc-line-content">${escapeHTML(cols.join("   "))}</span>
          </div>
        `;
        rows.forEach(r => {
          const lineStr = cols.map(c => r[c] !== null && r[c] !== undefined ? String(r[c]) : "NULL").join("   ");
          html += `
            <div class="tc-line-row">
              <span class="tc-line-num">${lineIdx++}</span>
              <span class="tc-line-content">${escapeHTML(lineStr)}</span>
            </div>
          `;
        });
      } else {
        html += `
          <div class="tc-line-row">
            <span class="tc-line-num">${lineIdx++}</span>
            <span class="tc-line-content" style="color: var(--text-editor-muted); font-style: italic;">(0 rows / empty table)</span>
          </div>
        `;
      }
    }
    return html;
  },

  formatRowsToLines(rows) {
    if (!rows || rows.length === 0) {
      return `<div class="tc-line-row"><span class="tc-line-num">1</span><span class="tc-line-content" style="color: var(--text-editor-muted); font-style: italic;">(0 rows / empty result set)</span></div>`;
    }
    const cols = Object.keys(rows[0]);
    let html = "";
    let lineIdx = 1;
    html += `
      <div class="tc-line-row tc-cols-header-row" style="opacity: 0.8; font-weight: 600;">
        <span class="tc-line-num">${lineIdx++}</span>
        <span class="tc-line-content">${escapeHTML(cols.join("   |   "))}</span>
      </div>
    `;
    rows.forEach((r) => {
      const lineStr = cols.map(c => {
        const val = r[c];
        return val === null || val === undefined ? "NULL" : String(val);
      }).join("   |   ");
      html += `
        <div class="tc-line-row">
          <span class="tc-line-num">${lineIdx++}</span>
          <span class="tc-line-content">${escapeHTML(lineStr)}</span>
        </div>
      `;
    });
    return html;
  },

  renderTestCaseEditor(activeTc, idx) {
    const isTable = state.testcaseEditMode === "table";
    const inputData = activeTc.input_data || {};
    const tableNames = Object.keys(inputData);

    let editorContentHtml = "";
    if (isTable) {
      if (tableNames.length === 0) {
        editorContentHtml = `<div style="color: var(--text-editor-muted); font-size: 0.85rem; padding: 10px;">No tables defined in testcase. Switch to JSON mode to define tables.</div>`;
      } else {
        tableNames.forEach(tbl => {
          const rows = inputData[tbl] || [];
          const cols = (rows.length > 0) ? Object.keys(rows[0]) : (
            (state.currentQuestion.tables || []).find(t => t.table_name === tbl)?.columns.map(c => c.column_name) || []
          );

          let tableHeaderCols = cols.map(c => `<th>${escapeHTML(c)}</th>`).join("");
          tableHeaderCols += `<th style="width: 32px; text-align: center;"></th>`;

          let tableBodyRows = "";
          rows.forEach((r, rIdx) => {
            let rowCells = cols.map(c => {
              const val = r[c] !== null && r[c] !== undefined ? String(r[c]) : "";
              return `<td><input type="text" class="tc-cell-input" data-table="${escapeHTML(tbl)}" data-row="${rIdx}" data-col="${escapeHTML(c)}" value="${escapeHTML(val)}" placeholder="NULL" /></td>`;
            }).join("");
            tableBodyRows += `
              <tr data-row-idx="${rIdx}">
                ${rowCells}
                <td style="text-align: center;">
                  <button type="button" class="tc-row-del-btn" data-table="${escapeHTML(tbl)}" data-row="${rIdx}" title="Delete Row">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </td>
              </tr>
            `;
          });

          editorContentHtml += `
            <div class="tc-edit-table-block" data-table-name="${escapeHTML(tbl)}">
              <div class="tc-edit-table-header">
                <span class="tc-edit-table-name">Table: ${escapeHTML(tbl)}</span>
                <button type="button" class="tc-btn-add-row" data-table="${escapeHTML(tbl)}">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>Add Row</span>
                </button>
              </div>
              <div style="overflow-x: auto;">
                <table class="tc-table-grid">
                  <thead><tr>${tableHeaderCols}</tr></thead>
                  <tbody>${tableBodyRows || `<tr><td colspan="${cols.length + 1}" style="text-align: center; color: var(--text-editor-muted); padding: 8px; font-style: italic;">No rows. Click '+ Add Row' to insert data.</td></tr>`}</tbody>
                </table>
              </div>
            </div>
          `;
        });
      }
    } else {
      const jsonStr = JSON.stringify(inputData, null, 2);
      editorContentHtml = `
        <textarea id="tc-json-editor" class="tc-json-textarea" spellcheck="false" placeholder="Enter input tables JSON here...">${escapeHTML(jsonStr)}</textarea>
      `;
    }

    return `
      <div class="tc-edit-container">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <span style="font-size: 0.78rem; color: var(--text-editor-muted); font-weight: 500;">
            Modify input table rows or paste raw JSON. Ground-truth expected output is automatically calculated upon saving.
          </span>
          <div style="display: flex; gap: 4px;">
            <button id="btn-tc-mode-table" class="tc-edit-action-btn ${isTable ? 'active' : ''}">Table Mode</button>
            <button id="btn-tc-mode-json" class="tc-edit-action-btn ${!isTable ? 'active' : ''}">JSON Mode</button>
          </div>
        </div>

        ${editorContentHtml}

        <div class="tc-edit-bottom-bar">
          <button id="btn-tc-cancel-edit" class="tc-edit-action-btn">Cancel</button>
          <button id="btn-tc-save-edit" class="tc-edit-action-btn success">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Save & Derive Expected Output</span>
          </button>
        </div>
      </div>
    `;
  },

  attachTestCaseEditorListeners(activeTc, idx) {
    el("btn-tc-mode-table")?.addEventListener("click", () => {
      state.testcaseEditMode = "table";
      TestcaseComponent.renderTestcasePanel(idx);
    });

    el("btn-tc-mode-json")?.addEventListener("click", () => {
      state.testcaseEditMode = "json";
      TestcaseComponent.renderTestcasePanel(idx);
    });

    el("btn-tc-cancel-edit")?.addEventListener("click", () => {
      state.editingTestCaseIndex = null;
      TestcaseComponent.renderTestcasePanel(idx);
    });

    document.querySelectorAll(".tc-btn-add-row").forEach(btn => {
      btn.addEventListener("click", () => {
        const tbl = btn.dataset.table;
        if (!tbl || !activeTc.input_data[tbl]) return;
        const rows = activeTc.input_data[tbl];
        const newRow = {};
        const cols = rows.length > 0 ? Object.keys(rows[0]) : (
          (state.currentQuestion.tables || []).find(t => t.table_name === tbl)?.columns.map(c => c.column_name) || []
        );
        cols.forEach(c => newRow[c] = null);
        rows.push(newRow);
        TestcaseComponent.renderTestcasePanel(idx);
      });
    });

    document.querySelectorAll(".tc-row-del-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tbl = btn.dataset.table;
        const rIdx = parseInt(btn.dataset.row, 10);
        if (tbl && activeTc.input_data[tbl] && !isNaN(rIdx)) {
          activeTc.input_data[tbl].splice(rIdx, 1);
          TestcaseComponent.renderTestcasePanel(idx);
        }
      });
    });

    document.querySelectorAll(".tc-cell-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const tbl = e.target.dataset.table;
        const rIdx = parseInt(e.target.dataset.row, 10);
        const col = e.target.dataset.col;
        if (tbl && activeTc.input_data[tbl] && activeTc.input_data[tbl][rIdx]) {
          const val = e.target.value.trim();
          activeTc.input_data[tbl][rIdx][col] = val === "" ? null : val;
        }
      });
    });

    el("btn-tc-save-edit")?.addEventListener("click", async () => {
      const saveBtn = el("btn-tc-save-edit");
      if (saveBtn) saveBtn.disabled = true;

      try {
        if (state.testcaseEditMode === "json") {
          const jsonEl = el("tc-json-editor");
          if (jsonEl) {
            const parsed = JSON.parse(jsonEl.value);
            activeTc.input_data = parsed;
          }
        }
        activeTc.is_edited = true;

        const d = await Engine.deriveExpectedOutput(state.currentQuestion.slug, activeTc.input_data);
        if (d.success) {
          activeTc.expected_output = d.expected_output;
        }

        state.editingTestCaseIndex = null;
        TestcaseComponent.renderTestcasePanel(idx);
        showToast("Testcase updated & expected output derived!");
      } catch (err) {
        console.error("Save testcase failed:", err);
        showToast(`Error updating testcase: ${err.message}`);
        if (saveBtn) saveBtn.disabled = false;
      }
    });
  },

  deleteCustomCase(idx) {
    if (!state.currentQuestion || !state.currentQuestion.test_cases) return;
    const cases = state.currentQuestion.test_cases;
    if (!cases[idx]) return;
    cases.splice(idx, 1);
    state.editingTestCaseIndex = null;
    const nextIdx = Math.max(0, Math.min(idx, cases.length - 1));
    TestcaseComponent.renderTestcasePanel(nextIdx);
    showToast("Custom testcase deleted");
  },

  resetTestCaseToDefault(idx) {
    if (!state.currentQuestion || !state.currentQuestion.test_cases) return;
    const original = state.currentQuestion.original_test_cases && state.currentQuestion.original_test_cases[idx];
    if (!original) return;
    const tc = state.currentQuestion.test_cases[idx];
    tc.input_data = JSON.parse(JSON.stringify(original.input_data));
    tc.expected_output = JSON.parse(JSON.stringify(original.expected_output));
    tc.is_edited = false;
    state.editingTestCaseIndex = null;
    TestcaseComponent.renderTestcasePanel(idx);
    showToast(`Reset Case ${idx + 1} to original values`);
  },

  renderTestcasePanel(idx = 0) {
    state.activeTestCaseIndex = idx;
    let cases = (state.testResults && state.testResults.test_cases) || 
                (state.currentQuestion && state.currentQuestion.test_cases) || [];

    if (cases.length === 0 && state.currentQuestion && state.currentQuestion.sample_data) {
      cases = [
        {
          test_case_id: "tc_1_baseline",
          description: "Sample Data Baseline",
          category: "normal",
          input_data: state.currentQuestion.sample_data,
          expected_output: state.currentQuestion.expected_output || []
        }
      ];
    }

    const tabsRow = el("test-case-tabs");
    if (tabsRow) {
      tabsRow.innerHTML = "";
      cases.forEach((tc, i) => {
        const tabBtn = document.createElement("button");
        const isRun = Boolean(state.testResults && state.testResults.test_cases);
        const isPassed = tc.passed;
        let statusClass = "neutral";
        let iconHtml = "";

        if (isRun) {
          statusClass = isPassed ? "pass" : "fail";
          iconHtml = isPassed
            ? `<span class="tc-pill-icon pass"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`
            : `<span class="tc-pill-icon fail"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
        }

        tabBtn.className = `tc-tab-pill ${statusClass} ${i === idx ? "active" : ""}`;
        const titleLabel = tc.category === "custom" ? (tc.description || `Custom ${i + 1}`) : `Case ${i + 1}`;
        const editedMarker = tc.is_edited ? `<span style="font-size:0.75rem; color:var(--accent-blue); margin-left:3px;" title="User Modified Testcase">*</span>` : "";

        let closeBtnHtml = "";
        if (tc.category === "custom") {
          closeBtnHtml = `<span class="tc-tab-close-btn" title="Delete custom testcase" data-tc-idx="${i}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
        }

        tabBtn.innerHTML = `<span>${escapeHTML(titleLabel)}${editedMarker}</span> ${iconHtml} ${closeBtnHtml}`;
        tabBtn.title = tc.description || `Case ${i + 1}`;
        tabBtn.addEventListener("click", (e) => {
          if (e.target.closest(".tc-tab-close-btn")) {
            e.stopPropagation();
            TestcaseComponent.deleteCustomCase(i);
            return;
          }
          TestcaseComponent.renderTestcasePanel(i);
        });
        tabsRow.appendChild(tabBtn);
      });
    }

    const resultsEl = el("console-results");
    if (!resultsEl) return;

    if (cases.length === 0) {
      resultsEl.innerHTML = `<div style="color: var(--text-editor-muted); font-size: 0.85rem; padding: 12px;">No test cases found for this question.</div>`;
      return;
    }

    const activeTc = cases[idx] || cases[0];
    const isRun = Boolean(state.testResults && state.testResults.test_cases);
    const isEditing = state.editingTestCaseIndex === idx;

    const statusBadge = el("console-status-badge");
    const bracketIcon = el("testcase-bracket-icon");
    if (statusBadge) {
      if (isRun) {
        if (state.testResults.all_passed) {
          statusBadge.className = "testcase-status-badge pass";
          statusBadge.textContent = "Accepted";
          if (bracketIcon) bracketIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        } else {
          statusBadge.className = "testcase-status-badge fail";
          statusBadge.textContent = "Wrong Answer";
          if (bracketIcon) bracketIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        }
      } else {
        statusBadge.className = "testcase-status-badge ready";
        statusBadge.textContent = "Ready";
        if (bracketIcon) bracketIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
      }
    }

    let verdictHtml = "";
    let errorHtml = "";
    let outputSectionHtml = "";

    if (isRun) {
      if (activeTc.passed) {
        verdictHtml = `<h3 class="testcase-verdict pass">Accepted</h3>`;
      } else if (activeTc.error) {
        verdictHtml = `<h3 class="testcase-verdict fail">Runtime Error</h3>`;
        errorHtml = `
          <div class="runtime-error-box">
            <strong>Execution Error:</strong>
            <pre class="error-pre">${escapeHTML(activeTc.error)}</pre>
          </div>
        `;
      } else {
        verdictHtml = `<h3 class="testcase-verdict fail">Wrong Answer</h3>`;
      }

      outputSectionHtml = `
        <div class="tc-section-label">Your Output</div>
        <div class="testcase-code-box">${TestcaseComponent.formatRowsToLines(activeTc.actual_output)}</div>

        <div class="tc-section-label">Expected</div>
        <div class="testcase-code-box">${TestcaseComponent.formatRowsToLines(activeTc.expected_output)}</div>

        <div style="font-size: 0.76rem; color: var(--text-editor-muted); margin-top: 10px;">
          ${escapeHTML(activeTc.message || "")} · ${activeTc.elapsed_ms || 0} ms
        </div>
      `;
    } else {
      outputSectionHtml = `
        <div class="tc-section-label">Expected Output Preview</div>
        <div class="testcase-code-box">${TestcaseComponent.formatRowsToLines(activeTc.expected_output)}</div>
        <div style="font-size: 0.78rem; color: var(--text-editor-muted); margin-top: 10px;">
          Case ${idx + 1}: ${escapeHTML(activeTc.description || "")} (${activeTc.category || "normal"}). Click <strong>Run</strong> (Cmd + ') or <strong>Submit</strong> (Cmd + Enter) to validate.
        </div>
      `;
    }

    const inputBlockHtml = isEditing 
      ? TestcaseComponent.renderTestCaseEditor(activeTc, idx)
      : `<div class="testcase-code-box">${TestcaseComponent.formatTestCaseInputLines(activeTc)}</div>`;

    resultsEl.innerHTML = `
      ${verdictHtml}
      ${errorHtml}

      <div class="tc-section-header">
        <div class="tc-section-label">
          Input
          ${activeTc.is_edited ? '<span style="color: var(--accent-blue); font-size: 0.72rem; font-weight: normal; margin-left: 6px;">(Modified)</span>' : ''}
        </div>
        <div class="tc-input-actions">
          <button id="btn-toggle-edit-tc" class="tc-edit-action-btn ${isEditing ? 'active' : ''}" title="${isEditing ? 'Cancel Edit' : 'Edit Input Values'}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span>${isEditing ? 'Cancel Edit' : 'Edit Testcase'}</span>
          </button>
          ${activeTc.is_edited && activeTc.category !== 'custom' ? `
            <button id="btn-reset-tc" class="tc-edit-action-btn" title="Reset this testcase to original default input">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              <span>Reset Default</span>
            </button>
          ` : ''}
          ${activeTc.category === 'custom' ? `
            <button id="btn-delete-tc" class="tc-edit-action-btn danger" title="Delete this custom testcase">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              <span>Delete</span>
            </button>
          ` : ''}
        </div>
      </div>

      ${inputBlockHtml}

      ${outputSectionHtml}
    `;

    el("btn-toggle-edit-tc")?.addEventListener("click", () => {
      state.editingTestCaseIndex = isEditing ? null : idx;
      TestcaseComponent.renderTestcasePanel(idx);
    });

    el("btn-reset-tc")?.addEventListener("click", () => {
      TestcaseComponent.resetTestCaseToDefault(idx);
    });

    el("btn-delete-tc")?.addEventListener("click", () => {
      TestcaseComponent.deleteCustomCase(idx);
    });

    if (isEditing) {
      TestcaseComponent.attachTestCaseEditorListeners(activeTc, idx);
    }
  },

  async addNewCustomCase() {
    if (!state.currentQuestion) return;
    const cases = state.currentQuestion.test_cases = state.currentQuestion.test_cases || [];
    const customCount = cases.filter(c => c.category === "custom").length + 1;
    const sample = JSON.parse(JSON.stringify(state.currentQuestion.sample_data || {}));
    const customCase = {
      test_case_id: `custom_${Date.now()}`,
      category: "custom",
      description: `Custom Case ${customCount}`,
      input_data: sample,
      expected_output: [],
      is_edited: true
    };
    cases.push(customCase);
    const newIdx = cases.length - 1;
    state.editingTestCaseIndex = newIdx;
    TestcaseComponent.renderTestcasePanel(newIdx);

    try {
      const d = await Engine.deriveExpectedOutput(state.currentQuestion.slug, sample);
      if (d.success) {
        customCase.expected_output = d.expected_output;
        TestcaseComponent.renderTestcasePanel(newIdx);
      }
    } catch (e) {
      console.error("Derive expected failed:", e);
    }
    showToast(`Added Custom Case ${customCount}`);
  },

  resetConsole() {
    state.testResults = null;
    state.activeTestCaseIndex = 0;
    const bracketIcon = el("testcase-bracket-icon");
    if (bracketIcon) bracketIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;

    const statusBadge = el("console-status-badge");
    if (statusBadge) {
      statusBadge.className = "testcase-status-badge ready";
      statusBadge.textContent = "Ready";
    }

    TestcaseComponent.renderTestcasePanel(0);
  }
};
