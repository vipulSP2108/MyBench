/**
 * Shortcuts & Global Event Listeners Controller
 * Binds DOM click listeners, global keyboard shortcuts, drag-and-drop file import, and popovers.
 */

import { state, isQuestionSolved, isQuestionAttempted } from "../models/state.js";
import { Storage } from "../models/storage.js";
import { NavbarComponent } from "../views/components/navbar.js";
import { TimerComponent } from "../views/components/timer.js";
import { DrawerComponent } from "../views/components/drawer.js";
import { EditorComponent } from "../views/components/editor.js";
import { DescriptionComponent } from "../views/components/description.js";
import { TestcaseComponent } from "../views/components/testcase.js";
import { SplitterComponent } from "../views/components/splitter.js";
import { HomePage } from "../views/pages/home_page.js";
import { NotesPage } from "../views/pages/notes_page.js";
import { SettingsPage } from "../views/pages/settings_page.js";
import { FilterController } from "./filter_controller.js";
import { PracticeController } from "./practice_controller.js";
import { el, showToast } from "../utils.js";

export const ShortcutsController = {
  setupEventListeners() {
    el("nav-logo")?.addEventListener("click", () => state.emit("switchView", "home"));

    el("nav-btn-home")?.addEventListener("click", () => state.emit("switchView", "home"));
    el("nav-btn-notes")?.addEventListener("click", () => state.emit("switchView", "notes"));
    el("nav-btn-settings")?.addEventListener("click", () => state.emit("switchView", "settings"));
    el("header-progress-pill")?.addEventListener("click", () => state.emit("switchView", "home"));
    el("btn-theme-toggle")?.addEventListener("click", NavbarComponent.toggleTheme);

    el("btn-toggle-problem-list")?.addEventListener("click", DrawerComponent.toggleDrawer);
    el("btn-close-drawer")?.addEventListener("click", DrawerComponent.closeDrawer);
    el("drawer-backdrop")?.addEventListener("click", DrawerComponent.closeDrawer);

    el("btn-prev-q")?.addEventListener("click", () => state.emit("navigateQuestion", -1));
    el("btn-next-q")?.addEventListener("click", () => state.emit("navigateQuestion", 1));
    el("btn-random-q")?.addEventListener("click", () => {
      const list = state.filteredQuestions.length > 0 ? state.filteredQuestions : state.questions;
      if (list.length === 0) return;
      const rand = list[Math.floor(Math.random() * list.length)];
      state.emit("navigateToQuestion", rand.slug);
    });

    el("btn-quick-run")?.addEventListener("click", PracticeController.handleEditorPreview);
    el("btn-submit")?.addEventListener("click", PracticeController.handleEditorRun);

    el("tab-doc-desc")?.addEventListener("click", () => DescriptionComponent.setDocTab("desc"));
    el("tab-doc-editorial")?.addEventListener("click", () => DescriptionComponent.setDocTab("editorial"));
    el("tab-doc-notes")?.addEventListener("click", () => DescriptionComponent.setDocTab("notes"));

    el("btn-star-question")?.addEventListener("click", () => state.emit("toggleStarCurrentQuestion"));
    el("btn-bottom-star")?.addEventListener("click", () => state.emit("toggleStarCurrentQuestion"));

    el("btn-bottom-prev")?.addEventListener("click", () => state.emit("navigateQuestion", -1));
    el("btn-bottom-next")?.addEventListener("click", () => state.emit("navigateQuestion", 1));
    el("btn-bottom-notes")?.addEventListener("click", () => DescriptionComponent.setDocTab("notes"));

    el("btn-copy-solution")?.addEventListener("click", () => {
      if (state.currentQuestion && state.currentQuestion.reference_sql) {
        EditorComponent.setQueryCode(state.currentQuestion.reference_sql);
        const copyBtn = el("btn-copy-solution");
        if (copyBtn) {
          copyBtn.textContent = "Copied!";
          setTimeout(() => copyBtn.textContent = "Copy to Editor", 1500);
        }
        showToast("Solution copied to editor");
      }
    });

    el("btn-save-note")?.addEventListener("click", DescriptionComponent.savePersonalNote);
    el("btn-delete-note")?.addEventListener("click", () => DescriptionComponent.deletePersonalNote());
    el("user-note-input")?.addEventListener("blur", () => {
      const inputVal = el("user-note-input")?.value.trim() || "";
      const savedVal = state.userNotes[state.currentQuestion?.slug] || "";
      if (inputVal !== savedVal) {
        DescriptionComponent.savePersonalNote();
      }
    });

    el("btn-format-code")?.addEventListener("click", EditorComponent.formatEditorSQL);
    el("btn-reset-code")?.addEventListener("click", () => {
      if (!state.currentQuestion) return;
      if (confirm("Reset editor to starter query template?")) {
        PracticeController.setStarterTemplate(state.currentQuestion);
      }
    });
    el("btn-editor-settings")?.addEventListener("click", () => state.emit("switchView", "settings"));

    el("practice-timer-pill")?.addEventListener("click", (e) => {
      if (e.target.id === "btn-timer-reset" || e.target.closest("#btn-timer-reset")) return;
      TimerComponent.toggleTimer();
    });

    el("btn-timer-reset")?.addEventListener("click", (e) => {
      e.stopPropagation();
      TimerComponent.resetTimer();
      showToast("Timer reset");
    });

    SplitterComponent.initWorkspaceSplitters();
    SplitterComponent.initPanelCollapseControls();
    SplitterComponent.applySavedLayout();

    el("btn-add-custom-case")?.addEventListener("click", TestcaseComponent.addNewCustomCase);

    el("search-input")?.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      const clearBtn = el("btn-clear-search");
      if (clearBtn) clearBtn.style.display = state.searchQuery ? "block" : "none";
      FilterController.filterAndSortQuestions();
    });

    el("btn-clear-search")?.addEventListener("click", () => {
      const input = el("search-input");
      if (input) input.value = "";
      state.searchQuery = "";
      const clearBtn = el("btn-clear-search");
      if (clearBtn) clearBtn.style.display = "none";
      FilterController.filterAndSortQuestions();
    });

    el("sort-select")?.addEventListener("change", (e) => {
      state.selectedSort = e.target.value;
      localStorage.setItem("sqlmaster_sort", state.selectedSort);
      FilterController.filterAndSortQuestions();
    });

    el("company-select")?.addEventListener("change", (e) => {
      state.selectedCompany = e.target.value;
      FilterController.filterAndSortQuestions();
    });

    document.querySelectorAll(".adv-match-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".adv-match-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.advMatchMode = btn.dataset.match || "all";
        FilterController.filterAndSortQuestions();
      });
    });

    el("btn-add-filter-rule")?.addEventListener("click", () => {
      const existingFields = state.advRules.map(r => r.field);
      const candidateFields = ["status", "starred", "notes", "difficulty", "company", "tags"];
      const nextField = candidateFields.find(f => !existingFields.includes(f)) || "tags";

      let initialValues = [];
      if (nextField === "starred") initialValues = ["starred"];
      if (nextField === "notes") initialValues = ["has_notes"];

      state.advRules.push({
        id: Date.now() + Math.random(),
        field: nextField,
        op: "is",
        values: initialValues
      });
      FilterController.renderAdvFilterRules();
      FilterController.filterAndSortQuestions();
    });

    el("btn-minimize-adv-rules")?.addEventListener("click", () => {
      FilterController.toggleAdvRulesMinimized();
    });

    el("btn-reset-adv-filter")?.addEventListener("click", () => {
      state.advRules = [
        { id: 1, field: "status", op: "is", values: [] },
        { id: 2, field: "difficulty", op: "is", values: [] }
      ];
      state.advMatchMode = "all";
      document.querySelectorAll(".adv-match-btn").forEach(b => b.classList.toggle("active", b.dataset.match === "all"));
      FilterController.renderAdvFilterRules();
      FilterController.filterAndSortQuestions();
      showToast("Filter rules reset to default");
    });

    document.querySelectorAll(".home-jump-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const diff = (btn.dataset.filter || "").toLowerCase();
        const matching = state.questions.filter(q => q.difficulty.toLowerCase() === diff);
        const target = matching.find(q => !state.solvedSlugs.has(q.slug)) || matching[0];
        if (target) {
          state.emit("navigateToQuestion", target.slug);
        } else {
          showToast(`No ${diff} questions found`);
        }
      });
    });

    el("home-btn-resume")?.addEventListener("click", () => {
      const savedSlug = localStorage.getItem("sqlmaster_current_slug");
      const target = (savedSlug && state.questions.find(q => q.slug === savedSlug)) ||
                     state.questions.find(q => isQuestionAttempted(q.slug)) || 
                     state.questions.find(q => !isQuestionSolved(q.slug)) || 
                     state.questions[0];
      if (target) {
        state.emit("navigateToQuestion", target.slug);
      }
    });

    document.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.homeSegment = btn.dataset.segment;
        HomePage.renderActiveFilterTags();
        HomePage.renderHomeProblemsTable();
      });
    });

    document.querySelectorAll(".home-match-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".home-match-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.homeMatchMode = btn.dataset.match || "all";
        HomePage.renderHomeProblemsTable();
      });
    });

    const menuStatus = el("menu-filter-status");
    const menuDiff = el("menu-filter-diff");
    const menuCompany = el("menu-filter-company");

    el("btn-filter-status")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = !menuStatus || menuStatus.style.display === "none";
      if (menuDiff) menuDiff.style.display = "none";
      if (menuCompany) menuCompany.style.display = "none";
      if (menuStatus) menuStatus.style.display = isHidden ? "block" : "none";
    });

    el("btn-filter-diff")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = !menuDiff || menuDiff.style.display === "none";
      if (menuStatus) menuStatus.style.display = "none";
      if (menuCompany) menuCompany.style.display = "none";
      if (menuDiff) menuDiff.style.display = isHidden ? "block" : "none";
    });

    el("btn-filter-company")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = !menuCompany || menuCompany.style.display === "none";
      if (menuStatus) menuStatus.style.display = "none";
      if (menuDiff) menuDiff.style.display = "none";
      if (menuCompany) {
        menuCompany.style.display = isHidden ? "block" : "none";
        if (isHidden) setTimeout(() => el("menu-search-companies")?.focus(), 100);
      }
    });

    document.addEventListener("click", (e) => {
      if (menuStatus && !menuStatus.contains(e.target) && !el("btn-filter-status")?.contains(e.target)) {
        menuStatus.style.display = "none";
      }
      if (menuDiff && !menuDiff.contains(e.target) && !el("btn-filter-diff")?.contains(e.target)) {
        menuDiff.style.display = "none";
      }
      if (menuCompany && !menuCompany.contains(e.target) && !el("btn-filter-company")?.contains(e.target)) {
        menuCompany.style.display = "none";
      }
    });

    document.querySelectorAll(".filter-cb-status").forEach(cb => {
      cb.addEventListener("change", () => {
        if (cb.checked) {
          state.homeStatusFilters.add(cb.value);
        } else {
          state.homeStatusFilters.delete(cb.value);
        }
        HomePage.renderActiveFilterTags();
        HomePage.renderHomeProblemsTable();
      });
    });

    document.querySelectorAll(".filter-cb-diff").forEach(cb => {
      cb.addEventListener("change", () => {
        if (cb.checked) {
          state.homeDiffFilters.add(cb.value);
        } else {
          state.homeDiffFilters.delete(cb.value);
        }
        HomePage.renderActiveFilterTags();
        HomePage.renderHomeProblemsTable();
      });
    });

    el("menu-search-companies")?.addEventListener("input", () => {
      HomePage.populateCompanyFilterOptions();
    });

    el("btn-filter-reset-all")?.addEventListener("click", () => {
      state.homeSegment = "all";
      state.homeStatusFilters.clear();
      state.homeDiffFilters.clear();
      state.homeCompany = "all";
      state.homeSearch = "";

      document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b.dataset.segment === "all"));
      document.querySelectorAll(".filter-cb-status, .filter-cb-diff").forEach(cb => cb.checked = false);
      const searchInput = el("home-sheet-search");
      if (searchInput) searchInput.value = "";
      const radioAll = document.querySelector('input[name="company-filter"][value="all"]');
      if (radioAll) radioAll.checked = true;

      state.homeMatchMode = "all";
      document.querySelectorAll(".home-match-btn").forEach(b => b.classList.toggle("active", b.dataset.match === "all"));

      HomePage.renderActiveFilterTags();
      HomePage.renderHomeProblemsTable();
      showToast("All filters reset");
    });

    const handleRandomPractice = () => {
      if (state.questions.length === 0) return;
      const rand = state.questions[Math.floor(Math.random() * state.questions.length)];
      state.emit("navigateToQuestion", rand.slug);
    };
    el("home-btn-random")?.addEventListener("click", handleRandomPractice);
    el("btn-pick-randomly")?.addEventListener("click", handleRandomPractice);

    el("home-sheet-search")?.addEventListener("input", (e) => {
      state.homeSearch = e.target.value;
      HomePage.renderHomeProblemsTable();
    });

    el("btn-streak-prev")?.addEventListener("click", () => showToast("Viewing previous month streak"));
    el("btn-streak-next")?.addEventListener("click", () => showToast("Viewing current month streak"));

    el("home-btn-view-all-starred")?.addEventListener("click", () => {
      state.homeSegment = "starred";
      document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b.dataset.segment === "starred"));
      HomePage.renderActiveFilterTags();
      HomePage.renderHomeProblemsTable();
      el("home-sheet-counter")?.scrollIntoView({ behavior: "smooth" });
    });

    el("home-btn-view-all-notes")?.addEventListener("click", () => state.emit("switchView", "notes"));
    el("notes-search-input")?.addEventListener("input", NotesPage.renderNotesHub);

    el("setting-theme")?.addEventListener("change", (e) => {
      NavbarComponent.applyTheme(e.target.value);
      showToast(`Switched to ${e.target.value === "dark" ? "Dark Mode" : "Light Mode"}`);
    });

    el("setting-shortcut-run")?.addEventListener("change", (e) => {
      state.settings.shortcutRun = e.target.value;
      localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
      showToast("Run shortcut updated");
    });

    el("setting-shortcut-preview")?.addEventListener("change", (e) => {
      state.settings.shortcutPreview = e.target.value;
      localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
      showToast("Preview shortcut updated");
    });

    el("setting-show-tags")?.addEventListener("change", (e) => {
      state.settings.showTopicTags = e.target.checked;
      localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
      if (state.currentQuestion) DescriptionComponent.renderQuestionDetail(state.currentQuestion);
      showToast(state.settings.showTopicTags ? "Topic tags enabled" : "Topic tags hidden");
    });

    el("setting-font-size")?.addEventListener("change", (e) => {
      state.settings.fontSize = e.target.value;
      localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
      EditorComponent.applySettingsToEditor();
    });

    el("setting-auto-format")?.addEventListener("change", (e) => {
      state.settings.autoFormat = e.target.checked;
      localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
    });

    el("setting-code-theme")?.addEventListener("change", (e) => {
      NavbarComponent.applyCodeTheme(e.target.value);
      showToast(`Code theme set to ${e.target.value}`);
    });

    el("setting-plain-mode")?.addEventListener("change", (e) => {
      NavbarComponent.applyCodeTheme(null, e.target.checked);
      showToast(e.target.checked ? "Interview Mode: Plain B&W enabled" : "Syntax coloring enabled");
    });

    el("setting-autocomplete-mode")?.addEventListener("change", (e) => {
      state.settings.autocompleteMode = e.target.value;
      localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
      localStorage.setItem("sqlmaster_autocomplete_mode", e.target.value);
      showToast(`Autocomplete: ${e.target.value}`);
    });

    const headerThemeWrap = el("header-theme-wrap");
    const headerThemeMenu = el("header-theme-menu");

    if (headerThemeWrap && headerThemeMenu) {
      headerThemeWrap.addEventListener("mouseenter", () => {
        headerThemeMenu.style.display = "flex";
      });
      headerThemeWrap.addEventListener("mouseleave", () => {
        headerThemeMenu.style.display = "none";
      });
    }

    document.querySelectorAll(".header-theme-option").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const themeVal = btn.dataset.themeVal;
        const codeVal = btn.dataset.codeVal;
        if (themeVal) NavbarComponent.applyTheme(themeVal);
        if (codeVal) NavbarComponent.applyCodeTheme(codeVal);
        if (headerThemeMenu) headerThemeMenu.style.display = "none";
        const name = btn.querySelector(".theme-opt-text")?.textContent || themeVal;
        showToast(`Theme switched: ${name}`);
      });
    });

    el("btn-toggle-plain-mode")?.addEventListener("click", NavbarComponent.togglePlainMode);

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#header-theme-wrap")) {
        if (headerThemeMenu) headerThemeMenu.style.display = "none";
      }
    });

    el("btn-bottom-run")?.addEventListener("click", PracticeController.handleEditorPreview);
    el("btn-bottom-submit")?.addEventListener("click", PracticeController.handleEditorRun);

    el("btn-export-full")?.addEventListener("click", Storage.exportFullBackup);
    el("btn-export-compact")?.addEventListener("click", Storage.exportCompactBackup);
    el("btn-export-data")?.addEventListener("click", Storage.exportCompactBackup);
    el("btn-trigger-import")?.addEventListener("click", () => el("input-import-backup")?.click());
    el("btn-browse-backup")?.addEventListener("click", (e) => {
      e.stopPropagation();
      el("input-import-backup")?.click();
    });
    el("input-import-backup")?.addEventListener("change", SettingsPage.handleImportFileSelect);

    const dropzone = el("backup-dropzone");
    if (dropzone) {
      dropzone.addEventListener("click", (e) => {
        if (e.target.id !== "btn-browse-backup" && !e.target.closest("#btn-browse-backup")) {
          el("input-import-backup")?.click();
        }
      });
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("dragover");
      });
      dropzone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("dragover");
      });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          SettingsPage.handleImportFileSelect({ target: { files: e.dataTransfer.files } });
        }
      });
    }

    let windowDragCounter = 0;
    window.addEventListener("dragenter", (e) => {
      e.preventDefault();
      windowDragCounter++;
      const overlay = el("global-drag-overlay");
      if (overlay) overlay.style.display = "flex";
    });
    window.addEventListener("dragleave", (e) => {
      e.preventDefault();
      windowDragCounter--;
      if (windowDragCounter <= 0) {
        windowDragCounter = 0;
        const overlay = el("global-drag-overlay");
        if (overlay) overlay.style.display = "none";
      }
    });
    window.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    window.addEventListener("drop", (e) => {
      e.preventDefault();
      windowDragCounter = 0;
      const overlay = el("global-drag-overlay");
      if (overlay) overlay.style.display = "none";
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.toLowerCase().endsWith(".json")) {
          SettingsPage.handleImportFileSelect({ target: { files: [file] } });
        } else {
          showToast("Please drop a valid .json SQLMaster backup file");
        }
      }
    });

    el("btn-close-restore-modal")?.addEventListener("click", SettingsPage.closeRestoreModal);
    el("btn-cancel-restore")?.addEventListener("click", SettingsPage.closeRestoreModal);
    el("btn-apply-restore")?.addEventListener("click", SettingsPage.handleApplyRestore);
    el("restore-modal")?.addEventListener("click", (e) => {
      if (e.target.id === "restore-modal") SettingsPage.closeRestoreModal();
    });
    el("btn-clear-drafts")?.addEventListener("click", Storage.clearDraftsOnly);
    el("btn-factory-reset")?.addEventListener("click", Storage.factoryResetAll);
    el("btn-refresh-storage")?.addEventListener("click", () => {
      SettingsPage.updateStorageUsageUI();
      showToast("Storage stats recalculated");
    });
    el("btn-free-cache")?.addEventListener("click", Storage.freeOfflineCache);
    el("btn-precache-offline")?.addEventListener("click", () => Storage.precacheAllQuestionsForOffline(true));

    const handleResetProgress = () => {
      if (confirm("Are you sure you want to reset all solved and attempted progress? (Stars and notes will be preserved)")) {
        state.solvedSlugs.clear();
        state.attemptedSlugs.clear();
        localStorage.removeItem("sqlmaster_solved");
        localStorage.removeItem("sqlmaster_attempted");
        localStorage.removeItem("sqlmaster_total_submissions");
        state.emit("progressUpdated");
        DrawerComponent.renderQuestionList();
        if (state.currentQuestion) DescriptionComponent.renderQuestionDetail(state.currentQuestion);
        HomePage.renderHomeProblemsTable();
        HomePage.renderHomeDashboard();
        SettingsPage.updateStorageUsageUI();
        showToast("Practice progress reset to 0/100");
      }
    };

    el("btn-reset-progress")?.addEventListener("click", handleResetProgress);
    el("btn-progress-reset")?.addEventListener("click", handleResetProgress);

    window.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.code === "Slash" || e.keyCode === 191)) {
        e.preventDefault();
        e.stopPropagation();
        if (state.editor) {
          EditorComponent.toggleSqlComment(state.editor);
        } else {
          const tx = el("sql-editor");
          if (tx) EditorComponent.toggleSqlCommentTextarea(tx);
        }
        return;
      }

      if (e.key === "Escape") {
        if (el("restore-modal") && el("restore-modal").style.display === "flex") {
          SettingsPage.closeRestoreModal();
          return;
        }
        if (state.drawerOpen) {
          DrawerComponent.closeDrawer();
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (state.settings.shortcutRun === "cmd-enter") {
          e.preventDefault();
          PracticeController.handleEditorRun();
          return;
        }
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "'" || e.key === "\"")) {
        if (state.settings.shortcutPreview === "cmd-quote") {
          e.preventDefault();
          PracticeController.handleEditorPreview();
          return;
        }
      }

      if (e.altKey && (e.key === "q" || e.key === "Q")) {
        e.preventDefault();
        DrawerComponent.toggleDrawer();
        return;
      }

      if (e.altKey && e.key === "[") {
        e.preventDefault();
        state.emit("navigateQuestion", -1);
        return;
      }

      if (e.altKey && e.key === "]") {
        e.preventDefault();
        state.emit("navigateQuestion", 1);
        return;
      }
    }, true);
  }
};
