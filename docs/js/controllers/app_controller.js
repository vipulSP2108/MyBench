/**
 * Application Controller & Router
 * Coordinates lifecycle initialization, view routing, question bank loading, and cross-component events.
 */

import { state, syncAttemptedSlugs, recordAttempt } from "../models/state.js";
import { Storage } from "../models/storage.js";
import { NavbarComponent } from "../views/components/navbar.js";
import { TimerComponent } from "../views/components/timer.js";
import { DrawerComponent } from "../views/components/drawer.js";
import { EditorComponent } from "../views/components/editor.js";
import { DescriptionComponent } from "../views/components/description.js";
import { TestcaseComponent } from "../views/components/testcase.js";
import { SplitterComponent } from "../views/components/splitter.js";
import { PaletteComponent } from "../views/components/palette.js";
import { HomePage } from "../views/pages/home_page.js";
import { InsightsPage } from "../views/pages/insights_page.js";
import { NotesPage } from "../views/pages/notes_page.js";
import { SettingsPage } from "../views/pages/settings_page.js";
import { FilterController } from "./filter_controller.js";
import { PracticeController } from "./practice_controller.js";
import { ShortcutsController } from "./shortcuts_controller.js";
import { el, showToast } from "../utils.js";

export const AppController = {
  async init() {
    AppController.bindEvents();
    AppController.restorePreferences();
    EditorComponent.initEditor();
    ShortcutsController.setupEventListeners();
    PaletteComponent.init();
    TimerComponent.setupTimerControls();
    NavbarComponent.updateProgressUI();
    DescriptionComponent.updateNotesCountBadge();

    if (state.settings.autoStartTimer) {
      TimerComponent.startTimer();
    } else {
      TimerComponent.updateTimerUI();
    }

    await AppController.loadQuestions();
    window.addEventListener("hashchange", AppController.handleHashNavigation);
  },

  bindEvents() {
    state.on("switchView", (view) => AppController.switchView(view));
    state.on("navigateToQuestion", (slug) => {
      AppController.switchView("practice");
      AppController.loadQuestionDetail(slug);
    });
    state.on("navigateQuestion", (delta) => AppController.navigateQuestion(delta));
    state.on("toggleStarCurrentQuestion", () => AppController.toggleStarCurrentQuestion());
    state.on("setDocTab", (tab) => DescriptionComponent.setDocTab(tab));

    state.on("progressUpdated", () => {
      NavbarComponent.updateProgressUI();
      DrawerComponent.updateDrawerStats();
      HomePage.renderHomeDashboard();
    });

    state.on("notesUpdated", () => {
      DescriptionComponent.updateNotesCountBadge();
      if (state.currentView === "notes") NotesPage.renderNotesHub();
      HomePage.updateNotesSidebar();
    });

    state.on("storageUpdated", () => {
      SettingsPage.updateStorageUsageUI();
      NavbarComponent.updateProgressUI();
      DrawerComponent.renderQuestionList();
      HomePage.renderHomeProblemsTable();
      HomePage.renderHomeDashboard();
    });

    state.on("editorRun", () => PracticeController.handleEditorRun());
    state.on("editorPreview", () => PracticeController.handleEditorPreview());
    state.on("syncRailTab", () => SplitterComponent.syncRailActiveTab());
  },

  restorePreferences() {
    syncAttemptedSlugs();

    const savedTheme = localStorage.getItem("sqlmaster_theme") || "light";
    NavbarComponent.applyTheme(savedTheme);

    const savedSort = localStorage.getItem("sqlmaster_sort");
    const sortSelect = el("sort-select");
    if (savedSort && sortSelect) {
      sortSelect.value = savedSort;
      state.selectedSort = savedSort;
    }

    const sRun = el("setting-shortcut-run");
    const sPrev = el("setting-shortcut-preview");
    const sTags = el("setting-show-tags");
    const sFont = el("setting-font-size");
    const sAuto = el("setting-auto-format");
    const sTheme = el("setting-theme");
    const sCodeTheme = el("setting-code-theme");
    const sPlainMode = el("setting-plain-mode");
    const sAutoTimer = el("setting-auto-start-timer");
    const sAutoMode = el("setting-autocomplete-mode");
    const sAttemptTrigger = el("setting-attempt-trigger");

    if (sTheme) sTheme.value = state.theme;
    if (sCodeTheme) sCodeTheme.value = state.codeTheme;
    if (sPlainMode) sPlainMode.checked = state.plainMode;
    if (sAutoMode) sAutoMode.value = state.settings.autocompleteMode || "standard";
    if (sAttemptTrigger) {
      sAttemptTrigger.value = state.settings.attemptTrigger || "run";
      sAttemptTrigger.addEventListener("change", (e) => {
        state.settings.attemptTrigger = e.target.value;
        localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
        const labels = {
          run: "On First Run (Default)",
          submit: "On First Submit Only",
          open: "When Question is Opened"
        };
        showToast(`Attempt trigger set to: ${labels[e.target.value] || e.target.value}`);
      });
    }

    const btnResetAttempted = el("btn-reset-attempted");
    if (btnResetAttempted) {
      btnResetAttempted.addEventListener("click", () => {
        state.attemptedSlugs.clear();
        localStorage.setItem("sqlmaster_attempted", "[]");
        NavbarComponent.updateProgressUI();
        DrawerComponent.renderQuestionList();
        if (state.currentQuestion) DescriptionComponent.renderQuestionDetail(state.currentQuestion);
        HomePage.renderHomeProblemsTable();
        showToast("Attempted questions list has been reset");
      });
    }

    if (sAutoTimer) {
      sAutoTimer.checked = !!state.settings.autoStartTimer;
      sAutoTimer.addEventListener("change", (e) => {
        state.settings.autoStartTimer = e.target.checked;
        localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
        showToast(`Auto-start Stopwatch ${e.target.checked ? "enabled" : "disabled"}`);
      });
    }
    if (sRun) sRun.value = state.settings.shortcutRun;
    if (sPrev) sPrev.value = state.settings.shortcutPreview;
    if (sTags) sTags.checked = state.settings.showTopicTags;
    if (sFont) sFont.value = state.settings.fontSize;
    if (sAuto) sAuto.checked = state.settings.autoFormat;

    NavbarComponent.applyCodeTheme(state.codeTheme, state.plainMode);
    EditorComponent.applySettingsToEditor();
  },

  switchView(viewName, updateHash = true) {
    state.currentView = viewName;

    const views = [
      { name: "practice", el: el("view-practice") },
      { name: "home", el: el("view-home") },
      { name: "insights", el: el("view-insights") },
      { name: "notes", el: el("view-notes") },
      { name: "settings", el: el("view-settings") }
    ];

    views.forEach(v => {
      if (v.el) v.el.classList.toggle("active", v.name === viewName);
    });

    const isPractice = viewName === "practice";
    const headerEditorNav = el("header-editor-nav");
    const headerPracticeActions = el("header-practice-actions");

    if (headerEditorNav) headerEditorNav.style.display = isPractice ? "flex" : "none";
    if (headerPracticeActions) headerPracticeActions.style.display = isPractice ? "flex" : "none";

    el("nav-btn-home")?.classList.toggle("active", viewName === "home");
    el("nav-btn-insights")?.classList.toggle("active", viewName === "insights");
    el("nav-btn-notes")?.classList.toggle("active", viewName === "notes");
    el("nav-btn-settings")?.classList.toggle("active", viewName === "settings");

    DrawerComponent.closeDrawer();
    try {
      localStorage.setItem("sqlmaster_current_view", viewName);
    } catch (e) {}

    if (updateHash) {
      if (viewName === "practice" && state.currentQuestion) {
        if (window.location.hash !== `#${state.currentQuestion.slug}`) {
          window.location.hash = state.currentQuestion.slug;
        }
      } else if (viewName === "home") {
        if (window.location.hash !== "#home" && window.location.hash !== "") {
          window.location.hash = "home";
        }
      } else if (viewName === "insights") {
        if (window.location.hash !== "#insights") window.location.hash = "insights";
      } else if (viewName === "notes") {
        if (window.location.hash !== "#notes") {
          window.location.hash = "notes";
        }
      } else if (viewName === "settings") {
        if (window.location.hash !== "#settings") {
          window.location.hash = "settings";
        }
      }
    }

    if (viewName === "practice") {
      if (state.editor) {
        setTimeout(() => state.editor.refresh(), 50);
      }
    } else if (viewName === "home") {
      HomePage.renderHomeDashboard();
    } else if (viewName === "insights") {
      InsightsPage.render();
    } else if (viewName === "notes") {
      NotesPage.renderNotesHub();
    } else if (viewName === "settings") {
      SettingsPage.updateStorageUsageUI();
    }
  },

  async loadQuestions() {
    let data = null;
    const candidateUrls = ["data/questions.json", "/data/questions.json", "/api/questions", "api/questions"];
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          data = await res.json();
          try {
            localStorage.setItem("sqlmaster_cached_questions", JSON.stringify(data));
          } catch (e) {}
          break;
        }
      } catch (e) {}
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      const cached = localStorage.getItem("sqlmaster_cached_questions");
      if (cached) {
        try {
          data = JSON.parse(cached);
          showToast("Loaded 100 questions from local offline cache");
        } catch (e) {}
      }
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error("Failed to load questions from network or cache");
      showToast("Failed to load questions. Please check connection.");
      return;
    }

    state.questions = data;

    const countBadge = el("question-count-badge");
    if (countBadge) countBadge.textContent = data.length;

    const companySelect = el("company-select");
    if (companySelect) {
      companySelect.innerHTML = `<option value="all">All Companies</option>`;
      const companies = Array.from(new Set(data.map(q => q.company).filter(Boolean))).sort();
      companies.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        companySelect.appendChild(opt);
      });
    }

    const homeCompanySelect = el("home-sheet-company-select");
    if (homeCompanySelect) {
      homeCompanySelect.innerHTML = `<option value="all">Company: All</option>`;
      const companies = Array.from(new Set(data.map(q => q.company).filter(Boolean))).sort();
      companies.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        homeCompanySelect.appendChild(opt);
      });
    }

    FilterController.loadSavedAdvRules();
    FilterController.applyAdvRulesMinimizedState(state.advRulesMinimized);
    document.querySelectorAll(".adv-match-btn").forEach(b => b.classList.toggle("active", b.dataset.match === state.advMatchMode));
    FilterController.renderAdvFilterRules();
    FilterController.filterAndSortQuestions();

    AppController.handleHashNavigation();

    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => {
        if (!localStorage.getItem("sqlmaster_cached_all_questions")) {
          Storage.precacheAllQuestionsForOffline(false);
        }
      });
    }
  },

  handleHashNavigation() {
    const rawHash = (window.location.hash || "").replace(/^#/, "").trim();
    if (!rawHash || rawHash === "home") {
      AppController.switchView("home", false);
      return;
    }
    if (rawHash === "insights") {
      AppController.switchView("insights", false);
      return;
    }
    if (rawHash === "notes") {
      AppController.switchView("notes", false);
      return;
    }
    if (rawHash === "settings") {
      AppController.switchView("settings", false);
      return;
    }
    if (rawHash === "practice") {
      const savedSlug = localStorage.getItem("sqlmaster_current_slug");
      const target = (savedSlug && state.questions.find(item => item.slug === savedSlug)) || 
                     state.currentQuestion || 
                     state.questions[0];
      if (target) {
        AppController.switchView("practice", false);
        if (!state.currentQuestion || state.currentQuestion.slug !== target.slug) {
          AppController.loadQuestionDetail(target.slug, true);
        }
      } else {
        AppController.switchView("home", false);
      }
      return;
    }

    const q = state.questions.find(item => item.slug === rawHash);
    if (q) {
      AppController.switchView("practice", false);
      AppController.loadQuestionDetail(q.slug, false);
    } else {
      AppController.switchView("home", false);
    }
  },

  async loadQuestionDetail(slug, updateHash = true) {
    try {
      let q = null;

      if (state.allQuestionsDetail && state.allQuestionsDetail[slug]) {
        q = JSON.parse(JSON.stringify(state.allQuestionsDetail[slug]));
      }

      if (!q) {
        const allCached = localStorage.getItem("sqlmaster_cached_all_questions");
        if (allCached) {
          try {
            const allObj = JSON.parse(allCached);
            if (allObj[slug]) {
              state.allQuestionsDetail = allObj;
              q = JSON.parse(JSON.stringify(allObj[slug]));
            }
          } catch (e) {}
        }
      }

      if (!q) {
        for (const url of ["data/questions-all.json", "/data/questions-all.json"]) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const allObj = await res.json();
              state.allQuestionsDetail = allObj;
              try {
                localStorage.setItem("sqlmaster_cached_all_questions", JSON.stringify(allObj));
              } catch (e) {}
              if (allObj[slug]) {
                q = JSON.parse(JSON.stringify(allObj[slug]));
                break;
              }
            }
          } catch (e) {}
        }
      }

      if (!q) {
        for (const url of [`/api/questions/${slug}`, `api/questions/${slug}`]) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              q = await res.json();
              try {
                localStorage.setItem(`sqlmaster_cached_q_${slug}`, JSON.stringify(q));
              } catch (e) {}
              break;
            }
          } catch (err) {
            console.warn(`Fetch for question ${slug} failed:`, err);
          }
        }
      }

      if (!q) {
        const cached = localStorage.getItem(`sqlmaster_cached_q_${slug}`);
        if (cached) {
          try {
            q = JSON.parse(cached);
          } catch (e) {}
        }
      }

      if (!q) {
        showToast(`Could not load details for '${slug}'`);
        return;
      }

      q.original_test_cases = JSON.parse(JSON.stringify(q.test_cases || []));
      state.currentQuestion = q;
      state.editingTestCaseIndex = null;

      try {
        localStorage.setItem("sqlmaster_current_slug", slug);
        localStorage.setItem("sqlmaster_current_view", "practice");
      } catch (e) {}

      if (updateHash && state.currentView === "practice") {
        if (window.location.hash !== `#${slug}`) {
          window.location.hash = slug;
        }
      }

      recordAttempt(slug, "open");

      DescriptionComponent.renderQuestionDetail(q);
      DrawerComponent.renderQuestionList();

      const savedDraft = localStorage.getItem(`sqlmaster_draft_${slug}`);
      if (savedDraft) {
        EditorComponent.setQueryCode(savedDraft);
      } else {
        PracticeController.setStarterTemplate(q);
      }

      DescriptionComponent.loadPersonalNote(q.slug);
      TestcaseComponent.resetConsole();

      if (state.settings.autoStartTimer) {
        TimerComponent.startTimer();
      } else {
        TimerComponent.updateTimerUI();
      }

      DescriptionComponent.setDocTab("desc");
    } catch (err) {
      console.error("Failed to load question details:", err);
      const titleEl = el("problem-title");
      if (titleEl) titleEl.textContent = "Question details could not be loaded";
      showToast("Failed to load question details");
    }
  },

  navigateQuestion(delta) {
    if (!state.currentQuestion) return;

    const list = state.filteredQuestions.length > 0 ? state.filteredQuestions : state.questions;
    if (list.length === 0) return;

    const currentIdx = list.findIndex(q => q.slug === state.currentQuestion.slug);
    let nextIdx;

    if (currentIdx === -1) {
      nextIdx = delta > 0 ? 0 : list.length - 1;
    } else {
      nextIdx = (currentIdx + delta + list.length) % list.length;
    }

    AppController.loadQuestionDetail(list[nextIdx].slug);
  },

  toggleStarCurrentQuestion() {
    if (!state.currentQuestion) return;
    const slug = state.currentQuestion.slug;
    const isStarred = state.starredSlugs.has(slug);

    if (isStarred) {
      state.starredSlugs.delete(slug);
      showToast("Removed from Starred");
    } else {
      state.starredSlugs.add(slug);
      showToast("Added to Starred");
    }

    localStorage.setItem("sqlmaster_starred", JSON.stringify(Array.from(state.starredSlugs)));
    DescriptionComponent.renderQuestionDetail(state.currentQuestion);
    DrawerComponent.renderQuestionList();
    HomePage.updateStarredSidebar();
  }
};
