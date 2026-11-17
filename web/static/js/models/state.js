/**
 * Application State Model
 * Centralized, reactive state store with event notification.
 */

const listeners = {};

export const DIFFICULTY_ORDER = {
  easy: 1,
  medium: 2,
  hard: 3
};

export const state = {
  questions: [],
  filteredQuestions: [],
  currentQuestion: null,
  currentView: "practice", // "practice" | "home" | "notes" | "settings"
  selectedDifficulty: "all", // "all" | "easy" | "medium" | "hard" | "starred"
  selectedCompany: "all",
  selectedSort: "default",
  searchQuery: "",
  drawerOpen: false,
  testcaseCollapsed: false,
  activeDocTab: "desc",
  editor: null,
  allQuestionsDetail: null,
  testResults: null,
  activeTestCaseIndex: 0,
  editingTestCaseIndex: null,
  testcaseEditMode: "table", // "table" | "json"

  // Home Sheet State
  homeSegment: "all", // "all" | "starred" | "notes"
  homeStatusFilters: new Set(), // Set of "solved" | "in-progress" | "unsolved"
  homeDiffFilters: new Set(), // Set of "easy" | "medium" | "hard"
  homeCompany: "all",
  homeSearch: "",
  homeMatchMode: "all", // "all" | "any"

  // Question Bank Drawer Filter Rules State
  advFilterOpen: true,
  advRulesMinimized: localStorage.getItem("sqlmaster_adv_rules_minimized") === "true",
  advMatchMode: "all",
  advRules: [
    { id: 1, field: "status", op: "is", values: [] },
    { id: 2, field: "difficulty", op: "is", values: [] }
  ],

  // Persistent Collections
  solvedSlugs: new Set(JSON.parse(localStorage.getItem("sqlmaster_solved") || "[]")),
  attemptedSlugs: new Set(JSON.parse(localStorage.getItem("sqlmaster_attempted") || "[]")),
  starredSlugs: new Set(JSON.parse(localStorage.getItem("sqlmaster_starred") || "[]")),
  userNotes: JSON.parse(localStorage.getItem("sqlmaster_user_notes") || "{}"),

  // Theme & Code Style (with backwards-compat migration)
  theme: localStorage.getItem("sqlmaster_theme") || "light",
  codeTheme: (() => {
    const raw = localStorage.getItem("sqlmaster_code_theme") || "light-syntax";
    const valid = ["light-syntax", "green-syntax", "dark-syntax"];
    return valid.includes(raw) ? raw : "light-syntax";
  })(),
  plainMode: localStorage.getItem("sqlmaster_plain_mode") === "true",

  layout: {
    descWidth: localStorage.getItem("sqlmaster_desc_width") ? parseInt(localStorage.getItem("sqlmaster_desc_width"), 10) : null,
    editorHeight: localStorage.getItem("sqlmaster_editor_height") ? parseInt(localStorage.getItem("sqlmaster_editor_height"), 10) : null,
    descCollapsed: localStorage.getItem("sqlmaster_desc_collapsed") === "true",
    descMaximized: false,
    editorMaximized: false,
    testcaseMaximized: false,
    testcaseCollapsed: localStorage.getItem("sqlmaster_testcase_collapsed") === "true"
  },

  // Settings
  settings: {
    shortcutRun: "cmd-enter",
    shortcutPreview: "cmd-quote",
    attemptTrigger: "run",
    showTopicTags: false,
    fontSize: "14px",
    autoFormat: true,
    autoStartTimer: false,
    autocompleteMode: localStorage.getItem("sqlmaster_autocomplete_mode") || "standard",
    codeTheme: (() => {
      const raw = localStorage.getItem("sqlmaster_code_theme") || "light-syntax";
      const valid = ["light-syntax", "green-syntax", "dark-syntax"];
      return valid.includes(raw) ? raw : "light-syntax";
    })(),
    plainMode: localStorage.getItem("sqlmaster_plain_mode") === "true",
    ...JSON.parse(localStorage.getItem("sqlmaster_settings") || "{}")
  },

  // Event Pub/Sub
  on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  },
  off(event, cb) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(fn => fn !== cb);
  },
  emit(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(fn => {
      try {
        fn(data);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    });
  }
};

export function isQuestionSolved(slug) {
  return state.solvedSlugs.has(slug);
}

export function isQuestionAttempted(slug) {
  if (state.solvedSlugs.has(slug)) return false;
  return state.attemptedSlugs.has(slug);
}

export function recordAttempt(slug, triggerType) {
  if (!slug || state.solvedSlugs.has(slug)) return;
  const configured = state.settings.attemptTrigger || "run";
  let shouldMark = false;

  if (configured === "open") {
    shouldMark = true;
  } else if (configured === "run") {
    shouldMark = (triggerType === "run" || triggerType === "submit");
  } else if (configured === "submit") {
    shouldMark = (triggerType === "submit");
  }

  if (shouldMark && !state.attemptedSlugs.has(slug)) {
    state.attemptedSlugs.add(slug);
    localStorage.setItem("sqlmaster_attempted", JSON.stringify(Array.from(state.attemptedSlugs)));
    state.emit("progressUpdated");
  }
}

export function syncAttemptedSlugs() {
  try {
    let changed = false;
    for (const slug of Array.from(state.attemptedSlugs)) {
      if (state.solvedSlugs.has(slug)) {
        state.attemptedSlugs.delete(slug);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem("sqlmaster_attempted", JSON.stringify(Array.from(state.attemptedSlugs)));
    }
  } catch (err) {
    console.warn("Could not sync attempted slugs:", err);
  }
}

export function getQuestionStatusKey(slug) {
  if (state.starredSlugs.has(slug)) return "starred";
  if (isQuestionSolved(slug)) return "solved";
  if (isQuestionAttempted(slug)) return "attempted";
  return "unsolved";
}
