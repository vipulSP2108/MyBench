/**
 * Navigation Bar & Header Component
 * Handles theme toggles, code style selection, view navigation tabs, and problem prev/next arrows.
 */

import { state } from "../../models/state.js";
import { el, showToast } from "../../utils.js";

export const NavbarComponent = {
  applyTheme(themeName) {
    state.theme = themeName;
    localStorage.setItem("sqlmaster_theme", themeName);
    document.documentElement.setAttribute("data-theme", themeName);
    document.body.setAttribute("data-theme", themeName);
    document.documentElement.setAttribute("data-code-theme", state.codeTheme);
    document.body.setAttribute("data-code-theme", state.codeTheme);

    const iconEl = el("theme-toggle-icon");
    if (iconEl) {
      iconEl.innerHTML = themeName === "dark"
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    }

    const themeSelect = el("setting-theme");
    if (themeSelect) {
      themeSelect.value = themeName;
    }

    setTimeout(() => { if (state.editor) state.editor.refresh(); }, 50);
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: themeName } }));
  },

  toggleTheme() {
    const next = state.theme === "dark" ? "light" : "dark";
    if (next === "light" && state.codeTheme === "dark-syntax") {
      state.codeTheme = "light-syntax";
      state.settings.codeTheme = "light-syntax";
      localStorage.setItem("sqlmaster_code_theme", "light-syntax");
    } else if (next === "dark" && state.codeTheme === "light-syntax") {
      state.codeTheme = "dark-syntax";
      state.settings.codeTheme = "dark-syntax";
      localStorage.setItem("sqlmaster_code_theme", "dark-syntax");
    }
    NavbarComponent.applyTheme(next);
    NavbarComponent.applyCodeTheme(state.codeTheme);
    showToast(`Switched to ${next === "dark" ? "Dark Mode" : "Light Mode"}`);
  },

  applyCodeTheme(themeName, isPlain = null) {
    const validThemes = ["light-syntax", "green-syntax", "dark-syntax"];
    if (themeName) {
      if (!validThemes.includes(themeName)) {
        themeName = "light-syntax";
      }
      state.codeTheme = themeName;
      state.settings.codeTheme = themeName;
      localStorage.setItem("sqlmaster_code_theme", themeName);
    } else {
      if (!validThemes.includes(state.codeTheme)) {
        state.codeTheme = "light-syntax";
        state.settings.codeTheme = state.codeTheme;
        localStorage.setItem("sqlmaster_code_theme", state.codeTheme);
      }
    }

    if (isPlain !== null) {
      state.plainMode = isPlain;
      state.settings.plainMode = isPlain;
      localStorage.setItem("sqlmaster_plain_mode", String(isPlain));
    }

    localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));

    document.documentElement.setAttribute("data-theme", state.theme);
    document.body.setAttribute("data-theme", state.theme);
    document.documentElement.setAttribute("data-code-theme", state.codeTheme);
    document.body.setAttribute("data-code-theme", state.codeTheme);
    document.documentElement.setAttribute("data-syntax-mode", state.plainMode ? "plain" : "highlighted");
    document.body.setAttribute("data-syntax-mode", state.plainMode ? "plain" : "highlighted");

    const themeLabel = el("theme-btn-label");
    if (themeLabel) {
      const labelMap = {
        "light-syntax": "Light Syntax",
        "green-syntax": "Green Syntax",
        "dark-syntax": "Dark Syntax"
      };
      themeLabel.textContent = labelMap[state.codeTheme] || "Light Syntax";
    }

    const themeIndicator = el("editor-theme-indicator");
    if (themeIndicator) {
      const labelMap = {
        "light-syntax": "Light Syntax",
        "green-syntax": "Green Syntax",
        "dark-syntax": "Dark Syntax"
      };
      themeIndicator.textContent = labelMap[state.codeTheme] || "Light Syntax";
    }

    const plainBadge = el("editor-plain-badge");
    if (plainBadge) {
      plainBadge.style.display = state.plainMode ? "inline-block" : "none";
    }

    const plainBtn = el("btn-toggle-plain-mode");
    const plainText = el("plain-btn-text");
    if (plainBtn) {
      plainBtn.classList.toggle("active", state.plainMode);
    }
    if (plainText) {
      plainText.textContent = state.plainMode ? "Interview Mode (ON)" : "Interview Mode";
    }

    document.querySelectorAll(".theme-menu-item").forEach(item => {
      item.classList.toggle("active", item.dataset.themeId === state.codeTheme);
    });

    const settingCodeTheme = el("setting-code-theme");
    if (settingCodeTheme) settingCodeTheme.value = state.codeTheme;

    const settingPlainMode = el("setting-plain-mode");
    if (settingPlainMode) settingPlainMode.checked = state.plainMode;

    if (state.editor) {
      state.editor.refresh();
    }
  },

  togglePlainMode() {
    const next = !state.plainMode;
    NavbarComponent.applyCodeTheme(null, next);
    if (next) {
      showToast(state.theme === "dark" ? "Interview Mode: Plain White text enabled (No syntax hints)" : "Interview Mode: Plain Black text enabled (No syntax hints)");
    } else {
      const labelMap = { "light-syntax": "Light Syntax", "green-syntax": "Green Syntax", "dark-syntax": "Dark Syntax" };
      showToast(`Syntax colors restored (${labelMap[state.codeTheme] || state.codeTheme})`);
    }
  },

  updateProgressUI() {
    const solvedCount = state.solvedSlugs.size;
    const total = state.questions.length || 100;
    const textEl = el("solved-stats-text");
    if (textEl) {
      textEl.textContent = `${solvedCount} / ${total}`;
    }
    const pill = el("header-progress-pill");
    if (pill) {
      pill.title = `${solvedCount} of ${total} Questions Solved (${((solvedCount/total)*100).toFixed(0)}%) - Click to open Dashboard`;
    }
  }
};
