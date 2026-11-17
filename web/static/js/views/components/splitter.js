/**
 * Workspace Splitter & Panel Layout Component
 * Manages dragging, resizing, collapse, maximize, and persistence for description, editor, and testcase panes.
 */

import { state } from "../../models/state.js";
import { el, showToast } from "../../utils.js";

export const SplitterComponent = {
  applySavedLayout() {
    const descPanel = el("description-panel");
    const editorWrap = el("editor-wrapper");

    if (state.layout.descWidth && descPanel) {
      descPanel.style.width = `${state.layout.descWidth}px`;
      descPanel.style.flex = `0 0 ${state.layout.descWidth}px`;
    }

    if (state.layout.editorHeight && editorWrap) {
      editorWrap.style.height = `${state.layout.editorHeight}px`;
      editorWrap.style.flex = `0 0 ${state.layout.editorHeight}px`;
    }

    if (state.layout.descCollapsed) {
      SplitterComponent.setDescCollapsed(true, false);
    }
    if (state.layout.testcaseCollapsed) {
      SplitterComponent.setTestcaseCollapsed(true, false);
    }
  },

  syncRailActiveTab() {
    const activeDocTab = document.querySelector(".doc-tab.active");
    const activeTabName = activeDocTab ? activeDocTab.dataset.tab : "desc";
    document.querySelectorAll(".rail-tab-item").forEach(item => {
      item.classList.toggle("active", item.dataset.tab === activeTabName);
    });
  },

  setDescCollapsed(isCollapsed, showNotification = true) {
    state.layout.descCollapsed = isCollapsed;
    localStorage.setItem("sqlmaster_desc_collapsed", String(isCollapsed));

    const descPanel = el("description-panel");
    const rail = el("desc-collapsed-rail");
    const resizerV = el("resizer-vertical");
    const editorPanel = el("editor-panel");

    if (isCollapsed) {
      if (descPanel) descPanel.style.display = "none";
      if (rail) rail.style.display = "flex";
      if (resizerV) resizerV.style.display = "none";
      if (editorPanel) {
        editorPanel.style.width = "";
        editorPanel.style.flex = "1 1 0px";
      }
      if (showNotification) showToast("Question panel collapsed (Click vertical bar to expand)");
    } else {
      if (descPanel) {
        descPanel.style.display = "flex";
        if (state.layout.descWidth) {
          descPanel.style.width = `${state.layout.descWidth}px`;
          descPanel.style.flex = `0 0 ${state.layout.descWidth}px`;
        } else {
          descPanel.style.width = "50%";
          descPanel.style.flex = "0 0 50%";
        }
      }
      if (rail) rail.style.display = "none";
      if (resizerV) resizerV.style.display = "flex";
      if (editorPanel) {
        editorPanel.style.width = "";
        editorPanel.style.flex = "1 1 0px";
      }
      if (showNotification) showToast("Question panel restored");
    }

    SplitterComponent.syncRailActiveTab();
    if (state.editor) setTimeout(() => state.editor.refresh(), 80);
  },

  setDescMaximized(isMax) {
    state.layout.descMaximized = isMax;
    const descPanel = el("description-panel");
    const editorPanel = el("editor-panel");
    const resizerV = el("resizer-vertical");
    const rail = el("desc-collapsed-rail");
    const btn = el("btn-maximize-desc");

    if (isMax) {
      if (descPanel) {
        descPanel.classList.add("maximized");
        descPanel.style.width = "100%";
        descPanel.style.flex = "1 1 100%";
      }
      if (editorPanel) editorPanel.style.display = "none";
      if (resizerV) resizerV.style.display = "none";
      if (rail) rail.style.display = "none";
      if (btn) {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
        btn.title = "Restore Split View";
      }
      showToast("Question panel maximized (Full Space)");
    } else {
      if (descPanel) {
        descPanel.classList.remove("maximized");
        if (state.layout.descWidth) {
          descPanel.style.width = `${state.layout.descWidth}px`;
          descPanel.style.flex = `0 0 ${state.layout.descWidth}px`;
        } else {
          descPanel.style.width = "50%";
          descPanel.style.flex = "0 0 50%";
        }
      }
      if (editorPanel) {
        editorPanel.style.display = "flex";
        editorPanel.style.flex = "1 1 0px";
      }
      if (resizerV) resizerV.style.display = "flex";
      if (btn) {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
        btn.title = "Maximize Question Panel (Full Space)";
      }
    }

    if (state.editor) setTimeout(() => state.editor.refresh(), 80);
  },

  setEditorMaximized(isMax) {
    state.layout.editorMaximized = isMax;
    const workspace = el("split-workspace");
    const editorPanel = el("editor-panel");
    const btn = el("btn-maximize-editor");

    if (isMax) {
      workspace?.classList.add("editor-maximized");
      if (editorPanel) {
        editorPanel.style.width = "100%";
        editorPanel.style.flex = "1 1 100%";
      }
      if (btn) {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
        btn.title = "Restore Split View";
      }
      showToast("Code editor maximized to full screen");
    } else {
      workspace?.classList.remove("editor-maximized");
      if (editorPanel) {
        editorPanel.style.width = "";
        editorPanel.style.flex = "1 1 0px";
      }
      if (btn) {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
        btn.title = "Maximize Editor (Full Workspace Space)";
      }
    }

    if (state.editor) setTimeout(() => state.editor.refresh(), 80);
  },

  setTestcaseCollapsed(isCollapsed, showNotification = true) {
    state.layout.testcaseCollapsed = isCollapsed;
    localStorage.setItem("sqlmaster_testcase_collapsed", String(isCollapsed));

    const testcasePanel = el("testcase-panel");
    const editorWrap = el("editor-wrapper");
    const btnCollapseEditor = el("btn-collapse-editor");
    const chevronIcon = el("chevron-testcase-icon");

    if (isCollapsed) {
      if (testcasePanel) {
        testcasePanel.classList.add("collapsed");
        testcasePanel.style.height = "";
        testcasePanel.style.flex = "";
      }
      if (editorWrap) {
        editorWrap.classList.add("full-height");
        editorWrap.style.height = "";
        editorWrap.style.flex = "";
      }
      if (chevronIcon) {
        chevronIcon.innerHTML = `<polyline points="18 15 12 9 6 15"/>`;
      }
      if (btnCollapseEditor) {
        btnCollapseEditor.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
        btnCollapseEditor.title = "Restore Testcase Panel";
      }
      if (showNotification) showToast("Testcase collapsed (Editor given full height)");
    } else {
      if (testcasePanel) {
        testcasePanel.classList.remove("collapsed");
        testcasePanel.style.height = "";
        testcasePanel.style.flex = "";
      }
      if (editorWrap) {
        editorWrap.classList.remove("full-height");
        if (state.layout.editorHeight) {
          editorWrap.style.height = `${state.layout.editorHeight}px`;
          editorWrap.style.flex = `0 0 ${state.layout.editorHeight}px`;
        } else {
          editorWrap.style.height = "52%";
          editorWrap.style.flex = "0 0 52%";
        }
      }
      if (chevronIcon) {
        chevronIcon.innerHTML = `<polyline points="6 9 12 15 18 9"/>`;
      }
      if (btnCollapseEditor) {
        btnCollapseEditor.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
        btnCollapseEditor.title = "Collapse Testcase / Full Editor Height";
      }
      if (showNotification) showToast("Testcase panel restored");
    }

    if (state.editor) setTimeout(() => state.editor.refresh(), 80);
  },

  setTestcaseMaximized(isMax) {
    state.layout.testcaseMaximized = isMax;
    const testcasePanel = el("testcase-panel");
    const editorWrap = el("editor-wrapper");
    const btn = el("btn-expand-testcase");

    if (isMax) {
      if (testcasePanel) {
        testcasePanel.classList.add("maximized");
        testcasePanel.style.height = "";
        testcasePanel.style.flex = "";
      }
      if (editorWrap) {
        editorWrap.classList.add("minimized");
        editorWrap.style.height = "";
        editorWrap.style.flex = "";
      }
      if (btn) {
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
        btn.title = "Restore Testcase Height";
      }
      showToast("Testcase panel maximized (Full Space)");
    } else {
      if (testcasePanel) {
        testcasePanel.classList.remove("maximized");
        testcasePanel.style.height = "";
        testcasePanel.style.flex = "";
      }
      if (editorWrap) {
        editorWrap.classList.remove("minimized");
        if (state.layout.editorHeight) {
          editorWrap.style.height = `${state.layout.editorHeight}px`;
          editorWrap.style.flex = `0 0 ${state.layout.editorHeight}px`;
        } else {
          editorWrap.style.height = "52%";
          editorWrap.style.flex = "0 0 52%";
        }
      }
      if (btn) {
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
        btn.title = "Maximize Testcase Panel (Full Space)";
      }
    }

    if (state.editor) setTimeout(() => state.editor.refresh(), 80);
  },

  initWorkspaceSplitters() {
    const resizerV = el("resizer-vertical");
    const resizerH = el("resizer-horizontal");
    const workspace = el("split-workspace");
    const descPanel = el("description-panel");
    const editorPanel = el("editor-panel");
    const editorWrap = el("editor-wrapper");
    const testcasePanel = el("testcase-panel");

    if (resizerV && workspace && descPanel && editorPanel) {
      let isDraggingV = false;

      const onPointerDownV = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        isDraggingV = true;
        try { resizerV.setPointerCapture(e.pointerId); } catch (_) {}
        resizerV.classList.add("active");
        document.body.classList.add("is-resizing-v");
      };

      const onPointerMoveV = (e) => {
        if (!isDraggingV) return;
        const rect = workspace.getBoundingClientRect();
        const rawW = e.clientX - rect.left;
        const minW = 160;
        const maxW = Math.max(minW, rect.width - 180);
        const clampedW = Math.max(minW, Math.min(rawW, maxW));

        descPanel.style.width = `${clampedW}px`;
        descPanel.style.flex = `0 0 ${clampedW}px`;
        state.layout.descWidth = clampedW;
        localStorage.setItem("sqlmaster_desc_width", String(clampedW));

        if (state.editor) state.editor.refresh();
      };

      const onPointerUpV = (e) => {
        if (isDraggingV) {
          isDraggingV = false;
          try { resizerV.releasePointerCapture(e.pointerId); } catch (_) {}
          resizerV.classList.remove("active");
          document.body.classList.remove("is-resizing-v");
          if (state.editor) state.editor.refresh();
        }
      };

      resizerV.addEventListener("pointerdown", onPointerDownV);
      resizerV.addEventListener("pointermove", onPointerMoveV);
      resizerV.addEventListener("pointerup", onPointerUpV);
      resizerV.addEventListener("pointercancel", onPointerUpV);

      resizerV.addEventListener("dblclick", () => {
        descPanel.style.width = "50%";
        descPanel.style.flex = "0 0 50%";
        state.layout.descWidth = null;
        localStorage.removeItem("sqlmaster_desc_width");
        if (state.editor) state.editor.refresh();
        showToast("Question / Editor split reset to 50/50");
      });
    }

    if (resizerH && editorPanel && editorWrap && testcasePanel) {
      let isDraggingH = false;

      const onPointerDownH = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (state.layout.testcaseCollapsed) {
          SplitterComponent.setTestcaseCollapsed(false, false);
        }
        isDraggingH = true;
        try { resizerH.setPointerCapture(e.pointerId); } catch (_) {}
        resizerH.classList.add("active");
        document.body.classList.add("is-resizing-h");
      };

      const onPointerMoveH = (e) => {
        if (!isDraggingH) return;
        const rect = editorPanel.getBoundingClientRect();
        const topBarH = 42;
        const bottomBarH = 44;
        const resizerHSize = 12;
        const availH = rect.height - topBarH - bottomBarH - resizerHSize;
        if (availH <= 60) return;

        const rawH = (e.clientY - rect.top) - topBarH;
        const clampedEditorH = Math.max(40, Math.min(rawH, availH - 38));

        editorWrap.style.height = `${clampedEditorH}px`;
        editorWrap.style.flex = `0 0 ${clampedEditorH}px`;
        state.layout.editorHeight = clampedEditorH;
        localStorage.setItem("sqlmaster_editor_height", String(clampedEditorH));

        if (state.editor) state.editor.refresh();
      };

      const onPointerUpH = (e) => {
        if (isDraggingH) {
          isDraggingH = false;
          try { resizerH.releasePointerCapture(e.pointerId); } catch (_) {}
          resizerH.classList.remove("active");
          document.body.classList.remove("is-resizing-h");
          if (state.editor) state.editor.refresh();
        }
      };

      resizerH.addEventListener("pointerdown", onPointerDownH);
      resizerH.addEventListener("pointermove", onPointerMoveH);
      resizerH.addEventListener("pointerup", onPointerUpH);
      resizerH.addEventListener("pointercancel", onPointerUpH);

      resizerH.addEventListener("dblclick", () => {
        editorWrap.style.height = "52%";
        editorWrap.style.flex = "0 0 52%";
        state.layout.editorHeight = null;
        localStorage.removeItem("sqlmaster_editor_height");
        if (state.editor) state.editor.refresh();
        showToast("Editor / Testcase height reset to default");
      });
    }
  },

  initPanelCollapseControls() {
    el("btn-collapse-desc")?.addEventListener("click", () => {
      SplitterComponent.setDescCollapsed(true);
    });

    el("btn-rail-expand")?.addEventListener("click", () => {
      SplitterComponent.setDescCollapsed(false);
    });

    document.querySelectorAll(".rail-tab-item").forEach(item => {
      item.addEventListener("click", () => {
        const tabName = item.dataset.tab;
        SplitterComponent.setDescCollapsed(false, false);
        if (tabName) state.emit("setDocTab", tabName);
      });
    });

    el("btn-maximize-desc")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      SplitterComponent.setDescMaximized(!state.layout.descMaximized);
    });

    el("btn-collapse-editor")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      SplitterComponent.setTestcaseCollapsed(!state.layout.testcaseCollapsed);
    });

    el("btn-maximize-editor")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      SplitterComponent.setEditorMaximized(!state.layout.editorMaximized);
    });

    el("btn-toggle-testcase")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      SplitterComponent.setTestcaseCollapsed(!state.layout.testcaseCollapsed);
    });

    el("btn-expand-testcase")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      SplitterComponent.setTestcaseMaximized(!state.layout.testcaseMaximized);
    });

    // Single click on collapsed testcase header immediately restores panel
    el("testcase-header")?.addEventListener("click", (e) => {
      if (state.layout.testcaseCollapsed && !e.target.closest("button")) {
        e.preventDefault();
        e.stopPropagation();
        SplitterComponent.setTestcaseCollapsed(false);
      }
    });
  }
};
