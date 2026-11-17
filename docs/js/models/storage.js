/**
 * Storage Model
 * Encapsulates LocalStorage access, backups, restores, and storage quota calculations.
 */

import { state, syncAttemptedSlugs } from "./state.js";
import { el, escapeHTML, formatBytes, showToast } from "../utils.js";

export const Storage = {
  formatBytes,

  calculateStorageUsage() {
    let totalBytes = 0;
    const categories = {
      drafts: { count: 0, bytes: 0 },
      notes: { count: 0, bytes: 0 },
      progress: { count: 0, bytes: 0 },
      cache: { count: 0, bytes: 0 },
      settings: { bytes: 0 },
      other: { bytes: 0 }
    };

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key) || "";
        const itemBytes = (key.length + val.length) * 2;
        totalBytes += itemBytes;

        if (key.startsWith("sqlmaster_draft_")) {
          categories.drafts.count++;
          categories.drafts.bytes += itemBytes;
        } else if (key === "sqlmaster_user_notes" || key === "sqlmaster_notes") {
          try {
            const notesObj = JSON.parse(val);
            categories.notes.count = Object.keys(notesObj).length;
          } catch (e) {
            categories.notes.count = 1;
          }
          categories.notes.bytes += itemBytes;
        } else if (
          key === "sqlmaster_solved" ||
          key === "sqlmaster_attempted" ||
          key === "sqlmaster_starred" ||
          key === "sqlmaster_total_submissions"
        ) {
          categories.progress.bytes += itemBytes;
        } else if (key.startsWith("sqlmaster_cached_") || key.startsWith("sqlmaster_qdetail_")) {
          categories.cache.count++;
          categories.cache.bytes += itemBytes;
        } else if (
          key.startsWith("sqlmaster_settings") ||
          key.startsWith("sqlmaster_theme") ||
          key.startsWith("sqlmaster_code_theme") ||
          key.startsWith("sqlmaster_plain_mode") ||
          key.startsWith("sqlmaster_sort") ||
          key.startsWith("sqlmaster_desc_") ||
          key.startsWith("sqlmaster_editor_") ||
          key.startsWith("sqlmaster_testcase_")
        ) {
          categories.settings.bytes += itemBytes;
        } else if (key.startsWith("sqlmaster_")) {
          categories.other.bytes += itemBytes;
        }
      }
    } catch (err) {
      console.warn("Storage inspection error:", err);
    }

    const quotaBytes = 5 * 1024 * 1024; // 5 MB standard localStorage quota
    const percentUsed = Math.min(100, (totalBytes / quotaBytes) * 100);

    return { totalBytes, quotaBytes, percentUsed, categories };
  },

  getSubmissionCount() {
    const stored = parseInt(localStorage.getItem("sqlmaster_total_submissions") || "0", 10);
    const solved = state.solvedSlugs.size;
    const attempting = Array.from(state.attemptedSlugs).filter(s => !state.solvedSlugs.has(s)).length;
    return Math.max(stored, solved + attempting);
  },

  recordSubmission() {
    const current = Storage.getSubmissionCount();
    const next = current + 1;
    localStorage.setItem("sqlmaster_total_submissions", String(next));
    return next;
  },

  exportFullBackup() {
    const drafts = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sqlmaster_draft_")) {
        const slug = key.replace("sqlmaster_draft_", "");
        drafts[slug] = localStorage.getItem(key);
      }
    }

    const subCount = Storage.getSubmissionCount();
    localStorage.setItem("sqlmaster_total_submissions", String(subCount));

    const starredList = Array.from(state.starredSlugs);
    const starredDetails = starredList.map(slug => {
      const q = state.questions.find(item => item.slug === slug);
      return {
        slug: slug,
        title: q?.title || slug,
        difficulty: q?.difficulty || "Medium",
        company: q?.company || ""
      };
    });

    const data = {
      version: 2,
      backup_type: "full",
      app: "SQLMaster / MyBench",
      exported_at: new Date().toISOString(),
      summary: {
        solved_count: state.solvedSlugs.size,
        attempted_count: state.attemptedSlugs.size,
        starred_count: state.starredSlugs.size,
        starred_slugs: starredList,
        starred_details: starredDetails,
        notes_count: Object.keys(state.userNotes || {}).length,
        drafts_count: Object.keys(drafts).length,
        total_submissions: subCount
      },
      solved: Array.from(state.solvedSlugs),
      attempted: Array.from(state.attemptedSlugs),
      starred: starredList,
      starred_details: starredDetails,
      notes: state.userNotes,
      drafts: drafts,
      submissions: subCount,
      settings: state.settings,
      ui_preferences: {
        theme: localStorage.getItem("sqlmaster_theme") || "light",
        codeTheme: localStorage.getItem("sqlmaster_code_theme") || "light-syntax",
        plainMode: localStorage.getItem("sqlmaster_plain_mode") === "true",
        sort: localStorage.getItem("sqlmaster_sort") || "default",
        descWidth: localStorage.getItem("sqlmaster_desc_width"),
        editorHeight: localStorage.getItem("sqlmaster_editor_height")
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sqlmaster_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Full Backup downloaded (${Object.keys(drafts).length} drafts, ${state.solvedSlugs.size} solved)`);
  },

  exportCompactBackup() {
    const subCount = Storage.getSubmissionCount();
    localStorage.setItem("sqlmaster_total_submissions", String(subCount));

    const starredList = Array.from(state.starredSlugs);
    const starredDetails = starredList.map(slug => {
      const q = state.questions.find(item => item.slug === slug);
      return {
        slug: slug,
        title: q?.title || slug,
        difficulty: q?.difficulty || "Medium",
        company: q?.company || ""
      };
    });

    const data = {
      solved: Array.from(state.solvedSlugs),
      attempted: Array.from(state.attemptedSlugs),
      starred: starredList,
      starred_details: starredDetails,
      notes: state.userNotes,
      submissions: subCount,
      settings: state.settings,
      exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sqlmaster_compact_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Compact Backup downloaded");
  },

  exportStudyGuide() {
    const total = state.questions.length || 100;
    const solved = state.solvedSlugs.size;
    let md = `# SQLMaster — Interview Preparation Study Guide\n\n`;
    md += `> Generated on ${new Date().toLocaleDateString()} | Progress: ${solved} / ${total} Solved (${((solved/total)*100).toFixed(0)}%)\n\n`;
    md += `## Table of Contents\n\n`;

    const solvedQuestions = state.questions.filter(q => state.solvedSlugs.has(q.slug));
    if (solvedQuestions.length === 0) {
      showToast("No solved problems to export yet! Solve questions to build your study guide.");
      return;
    }

    solvedQuestions.forEach((q, idx) => {
      md += `${idx + 1}. [${q.title} (${q.difficulty} - ${q.company || "General"})](#${q.slug})\n`;
    });
    md += `\n---\n\n`;

    solvedQuestions.forEach((q, idx) => {
      md += `### ${idx + 1}. ${q.title} <a id="${q.slug}"></a>\n\n`;
      md += `**Difficulty:** ${q.difficulty} | **Company:** ${q.company || "General"} | **Tests:** ${q.test_case_count}\n\n`;
      if (state.userNotes[q.slug]) {
        md += `#### Personal Notes & Approach\n> ${state.userNotes[q.slug].replace(/\n/g, "\n> ")}\n\n`;
      }
      const draft = Storage.getDraft(q.slug) || q.solution_sql || "-- No saved draft";
      md += `#### Solution Query (MySQL 8.0)\n\`\`\`sql\n${draft.trim()}\n\`\`\`\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SQLMaster_Study_Guide_${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Study guide downloaded: ${solvedQuestions.length} questions included!`);
  },

  applyRestoreData(data, mode = "merge") {
    try {
      if (!data || typeof data !== "object") {
        throw new Error("Invalid backup data format");
      }

      const isReplace = mode === "replace";

      // 1. Solved
      const solvedList = Array.isArray(data.solved) 
        ? data.solved 
        : Array.isArray(data.solvedSlugs) 
          ? data.solvedSlugs 
          : Array.isArray(data.summary?.solved_slugs) 
            ? data.summary.solved_slugs 
            : [];
      if (isReplace) state.solvedSlugs.clear();
      solvedList.forEach(s => {
        const slug = (typeof s === "object" && s?.slug) ? s.slug : s;
        if (typeof slug === "string") state.solvedSlugs.add(slug);
      });
      localStorage.setItem("sqlmaster_solved", JSON.stringify(Array.from(state.solvedSlugs)));

      // 2. Attempted
      const attemptedList = Array.isArray(data.attempted) 
        ? data.attempted 
        : Array.isArray(data.attemptedSlugs) 
          ? data.attemptedSlugs 
          : Array.isArray(data.summary?.attempted_slugs) 
            ? data.summary.attempted_slugs 
            : [];
      if (isReplace) state.attemptedSlugs.clear();
      attemptedList.forEach(s => {
        const slug = (typeof s === "object" && s?.slug) ? s.slug : s;
        if (typeof slug === "string") state.attemptedSlugs.add(slug);
      });
      localStorage.setItem("sqlmaster_attempted", JSON.stringify(Array.from(state.attemptedSlugs)));

      // 3. Starred
      const starredList = Array.isArray(data.starred)
        ? data.starred
        : Array.isArray(data.starredSlugs)
          ? data.starredSlugs
          : (data.summary && Array.isArray(data.summary.starred_slugs))
            ? data.summary.starred_slugs
            : (data.summary && Array.isArray(data.summary.starred_details))
              ? data.summary.starred_details
              : [];
      if (isReplace) state.starredSlugs.clear();
      starredList.forEach(s => {
        const slug = (typeof s === "object" && s?.slug) ? s.slug : s;
        if (typeof slug === "string") state.starredSlugs.add(slug);
      });
      localStorage.setItem("sqlmaster_starred", JSON.stringify(Array.from(state.starredSlugs)));

      // 4. Notes
      const notes = data.notes || data.userNotes || data.user_notes;
      if (notes && typeof notes === "object") {
        if (isReplace) state.userNotes = {};
        state.userNotes = { ...state.userNotes, ...notes };
        localStorage.setItem("sqlmaster_user_notes", JSON.stringify(state.userNotes));
      }

      // 5. Drafts
      if (isReplace) {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("sqlmaster_draft_")) toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
      }

      let restoredDraftsCount = 0;
      if (data.drafts && typeof data.drafts === "object") {
        for (const [slug, sql] of Object.entries(data.drafts)) {
          if (typeof sql === "string" && sql.trim().length > 0) {
            localStorage.setItem(`sqlmaster_draft_${slug}`, sql);
            state.attemptedSlugs.add(slug);
            restoredDraftsCount++;
          }
        }
        localStorage.setItem("sqlmaster_attempted", JSON.stringify(Array.from(state.attemptedSlugs)));
      }

      // 6. Submissions
      const subVal = data.submissions ?? data.total_submissions ?? data.summary?.total_submissions;
      if (subVal !== undefined && subVal !== null) {
        const sub = parseInt(subVal, 10);
        if (!isNaN(sub) && sub > 0) {
          const current = Storage.getSubmissionCount();
          const finalSub = isReplace ? sub : Math.max(current, sub);
          localStorage.setItem("sqlmaster_total_submissions", String(finalSub));
        }
      }

      // 7. Settings
      if (data.settings && typeof data.settings === "object") {
        state.settings = { ...state.settings, ...data.settings };
        localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
      }

      // 8. If active question, refresh draft in editor
      if (state.currentQuestion) {
        const curSlug = state.currentQuestion.slug;
        const draft = localStorage.getItem(`sqlmaster_draft_${curSlug}`);
        if (draft !== null && state.editor) {
          state.editor.setValue(draft);
        }
      }

      state.emit("storageUpdated");
      showToast(`🎉 Restore successful: ${state.solvedSlugs.size} solved, ${restoredDraftsCount} drafts, ${state.starredSlugs.size} starred`);
      return true;
    } catch (err) {
      console.error("Apply restore error:", err);
      showToast("Error applying restore: " + err.message);
      return false;
    }
  },

  clearDraftsOnly() {
    const draftKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sqlmaster_draft_")) {
        draftKeys.push(key);
      }
    }

    if (draftKeys.length === 0) {
      showToast("No saved SQL drafts found to clear");
      return;
    }

    if (confirm(`Are you sure you want to clear ${draftKeys.length} saved SQL drafts? Your solved/attempted counts, stars, and notes will NOT be affected.`)) {
      draftKeys.forEach(k => localStorage.removeItem(k));
      if (state.currentQuestion && state.editor) {
        state.editor.setValue("");
      }
      state.emit("storageUpdated");
      showToast(`Cleared ${draftKeys.length} saved SQL drafts from storage`);
    }
  },

  factoryResetAll() {
    const code = prompt('WARNING: This will completely erase ALL solved questions, notes, drafts, and preferences.\n\nType "RESET" to confirm:');
    if (code === "RESET") {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sqlmaster_")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      state.solvedSlugs.clear();
      state.attemptedSlugs.clear();
      state.starredSlugs.clear();
      state.userNotes = {};
      if (state.editor) state.editor.setValue("");
      state.emit("storageUpdated");
      showToast("Factory reset complete. All local data cleared.");
    }
  },

  freeOfflineCache() {
    const cacheKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("sqlmaster_cached_") || key.startsWith("sqlmaster_qdetail_"))) {
        cacheKeys.push(key);
      }
    }

    if (cacheKeys.length === 0) {
      showToast("No offline question cache in LocalStorage to clear");
      return;
    }

    if (confirm(`Remove offline question cache (${cacheKeys.length} items, ~2.5 MB) from LocalStorage to reclaim space?\n\nYour SQL query drafts, personal notes, and solved progress will remain 100% safe.`)) {
      cacheKeys.forEach(k => localStorage.removeItem(k));
      state.emit("storageUpdated");
      showToast("Reclaimed ~2.5 MB of LocalStorage!");
    }
  },

  async precacheAllQuestionsForOffline(showFeedback = true) {
    try {
      if (showFeedback) showToast("Caching all 100 questions locally for offline practice...");
      let allData = null;
      for (const url of ["data/questions-all.json", "/data/questions-all.json", "/api/questions-all", "api/questions-all"]) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            allData = await res.json();
            break;
          }
        } catch (e) {}
      }
      if (!allData) throw new Error("Could not fetch master questions database");
      state.allQuestionsDetail = allData;

      localStorage.setItem("sqlmaster_cached_all_questions", JSON.stringify(allData));
      localStorage.setItem("sqlmaster_cached_all_time", new Date().toISOString());

      const dupes = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sqlmaster_cached_q_")) dupes.push(k);
      }
      dupes.forEach(k => localStorage.removeItem(k));

      const count = Object.keys(allData).length;
      state.emit("storageUpdated");
      if (showFeedback) {
        showToast(`Success! All ${count} questions & schemas cached offline.`);
      }
    } catch (err) {
      console.error("Precache failed:", err);
      if (showFeedback) showToast("Precache failed: " + err.message);
    }
  }
};
