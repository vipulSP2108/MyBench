/**
 * Main Application Bootstrap
 * Entry point for modular ES MVC architecture.
 */

import { state, DIFFICULTY_ORDER, isQuestionSolved, isQuestionAttempted, recordAttempt, syncAttemptedSlugs, getQuestionStatusKey } from "./models/state.js";
import { Storage } from "./models/storage.js";
import { Engine } from "./models/engine.js";
import { normalizeVal, valsEqual, rowSortKey, rowsEqual, compareResults } from "./models/comparator.js";
import { NavbarComponent } from "./views/components/navbar.js";
import { TimerComponent } from "./views/components/timer.js";
import { DrawerComponent } from "./views/components/drawer.js";
import { EditorComponent } from "./views/components/editor.js";
import { DescriptionComponent } from "./views/components/description.js";
import { TestcaseComponent } from "./views/components/testcase.js";
import { SplitterComponent } from "./views/components/splitter.js";
import { PaletteComponent } from "./views/components/palette.js";
import { HomePage } from "./views/pages/home_page.js";
import { NotesPage } from "./views/pages/notes_page.js";
import { SettingsPage } from "./views/pages/settings_page.js";
import { FilterController } from "./controllers/filter_controller.js";
import { PracticeController } from "./controllers/practice_controller.js";
import { ShortcutsController } from "./controllers/shortcuts_controller.js";
import { AppController } from "./controllers/app_controller.js";
import { el, escapeHTML, formatBytes, showToast } from "./utils.js";

// Global exports for backwards compatibility with tests & console
window.state = state;
window.AppController = AppController;
window.PracticeController = PracticeController;
window.FilterController = FilterController;
window.Storage = Storage;
window.Engine = Engine;
window.EditorComponent = EditorComponent;
window.DescriptionComponent = DescriptionComponent;
window.TestcaseComponent = TestcaseComponent;
window.SplitterComponent = SplitterComponent;
window.HomePage = HomePage;
window.PaletteComponent = PaletteComponent;
window.NotesPage = NotesPage;
window.SettingsPage = SettingsPage;
window.NavbarComponent = NavbarComponent;
window.TimerComponent = TimerComponent;
window.DrawerComponent = DrawerComponent;

// Top-level aliases for headless automated test suite & scripts
window.loadQuestionDetail = (slug, autoRun) => AppController.loadQuestionDetail(slug, autoRun);
window.setQueryCode = (code) => EditorComponent.setQueryCode(code);
window.getQueryCode = () => EditorComponent.getQueryCode();
window.quickRunPreview = () => PracticeController.quickRunPreview();
window.runTests = () => PracticeController.runTests();
window.switchView = (view, updateHash) => AppController.switchView(view, updateHash);
window.isQuestionSolved = isQuestionSolved;
window.isQuestionAttempted = isQuestionAttempted;
window.recordAttempt = recordAttempt;
window.compareResults = compareResults;
window.showToast = showToast;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AppController.init());
} else {
  AppController.init();
}

export {
  state,
  AppController,
  PracticeController,
  FilterController,
  Storage,
  Engine,
  EditorComponent,
  DescriptionComponent,
  TestcaseComponent,
  SplitterComponent,
  HomePage,
  NotesPage,
  SettingsPage
};
