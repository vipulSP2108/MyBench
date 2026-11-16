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
    if (!q) return;
    DescriptionComponent.renderQuestionDetail(q);
    TestcaseComponent.resetConsole();
    DescriptionComponent.loadPersonalNote(q.slug);
    SplitterComponent.syncRailActiveTab();
  }
};
