/**
 * Settings & Storage Management Page
 * Displays LocalStorage quota usage, offline caching, and backup import/export workflows.
 */

import { state } from "../../models/state.js";
import { Storage } from "../../models/storage.js";
import { el, escapeHTML, formatBytes, showToast } from "../../utils.js";

let pendingRestoreData = null;

export const SettingsPage = {
  updateStorageUsageUI() {
    const usage = Storage.calculateStorageUsage();
    const quota = usage.quotaBytes;
    const freeBytes = Math.max(0, quota - usage.totalBytes);
    const freePct = Math.max(0, (freeBytes / quota) * 100);

    const usedText = el("storage-used-text");
    if (usedText) usedText.textContent = formatBytes(usage.totalBytes);

    const pctText = el("storage-used-pct");
    if (pctText) pctText.textContent = `${usage.percentUsed.toFixed(2)}%`;

    const freeText = el("storage-free-text");
    if (freeText) freeText.textContent = formatBytes(freeBytes);

    const freePctHead = el("storage-free-pct-head");
    if (freePctHead) freePctHead.textContent = `${freePct.toFixed(1)}%`;

    const getSegPctOfQuota = (bytes) => ((bytes / quota) * 100).toFixed(2) + "%";

    const segDrafts = el("seg-drafts");
    if (segDrafts) segDrafts.style.width = getSegPctOfQuota(usage.categories.drafts.bytes);

    const segNotes = el("seg-notes");
    if (segNotes) segNotes.style.width = getSegPctOfQuota(usage.categories.notes.bytes);

    const segProgress = el("seg-progress");
    if (segProgress) segProgress.style.width = getSegPctOfQuota(usage.categories.progress.bytes);

    const segCache = el("seg-cache");
    if (segCache) segCache.style.width = getSegPctOfQuota(usage.categories.cache.bytes);

    const segSettings = el("seg-settings");
    if (segSettings) segSettings.style.width = getSegPctOfQuota(usage.categories.settings.bytes);

    const segFree = el("seg-free");
    if (segFree) {
      segFree.style.width = `${freePct.toFixed(2)}%`;
      segFree.title = `Available Free Space: ${formatBytes(freeBytes)} (${freePct.toFixed(1)}%)`;
    }

    const draftsSize = el("storage-drafts-size");
    if (draftsSize) draftsSize.textContent = formatBytes(usage.categories.drafts.bytes);

    const draftsCount = el("storage-drafts-count");
    if (draftsCount) draftsCount.textContent = `${usage.categories.drafts.count} drafts saved`;

    const notesSize = el("storage-notes-size");
    if (notesSize) notesSize.textContent = formatBytes(usage.categories.notes.bytes);

    const notesCount = el("storage-notes-count");
    if (notesCount) notesCount.textContent = `${usage.categories.notes.count} problem notes`;

    const progressSize = el("storage-progress-size");
    if (progressSize) progressSize.textContent = formatBytes(usage.categories.progress.bytes);

    const progressCount = el("storage-progress-count");
    if (progressCount) {
      progressCount.textContent = `${state.solvedSlugs.size} solved, ${state.attemptedSlugs.size} attempted • ${state.starredSlugs.size} starred`;
    }

    const cacheSize = el("storage-cache-size");
    if (cacheSize) cacheSize.textContent = formatBytes(usage.categories.cache.bytes);

    const cacheCount = el("storage-cache-count");
    if (cacheCount) {
      const hasAll = !!localStorage.getItem("sqlmaster_cached_all_questions");
      cacheCount.textContent = hasAll ? "100 / 100 offline ready" : `${usage.categories.cache.count} cached`;
    }

    const settingsSize = el("storage-settings-size");
    if (settingsSize) settingsSize.textContent = formatBytes(usage.categories.settings.bytes);

    const freeSize = el("storage-free-size");
    if (freeSize) freeSize.textContent = formatBytes(freeBytes);

    const freeSub = el("storage-free-sub");
    if (freeSub) freeSub.textContent = `${freePct.toFixed(1)}% remaining`;

    const statusBadge = el("storage-status-badge");
    if (statusBadge) {
      if (usage.percentUsed > 85) {
        statusBadge.textContent = "High Usage";
        statusBadge.style.background = "rgba(239, 68, 68, 0.15)";
        statusBadge.style.color = "#ef4444";
        statusBadge.style.borderColor = "rgba(239, 68, 68, 0.3)";
      } else if (usage.percentUsed > 50) {
        statusBadge.textContent = "Moderate";
        statusBadge.style.background = "rgba(245, 158, 11, 0.15)";
        statusBadge.style.color = "#f59e0b";
        statusBadge.style.borderColor = "rgba(245, 158, 11, 0.3)";
      } else {
        statusBadge.textContent = "Healthy";
        statusBadge.style.background = "rgba(16, 185, 129, 0.12)";
        statusBadge.style.color = "#10b981";
        statusBadge.style.borderColor = "rgba(16, 185, 129, 0.25)";
      }
    }
  },

  handleImportFileSelect(e) {
    const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0];
    if (!file) return;

    showToast(`📂 Reading backup file: ${file.name}...`);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || typeof data !== "object") {
          throw new Error("File content is not a valid JSON object");
        }

        pendingRestoreData = { file, data, fileName: file.name };

        const isFull = !!(data.drafts || data.backup_type === "full");
        const solvedList = Array.isArray(data.solved) ? data.solved : (Array.isArray(data.summary?.solved_slugs) ? data.summary.solved_slugs : []);
        const attemptedList = Array.isArray(data.attempted) ? data.attempted : (Array.isArray(data.summary?.attempted_slugs) ? data.summary.attempted_slugs : []);
        const starredList = Array.isArray(data.starred) 
          ? data.starred 
          : (data.summary && Array.isArray(data.summary.starred_slugs))
            ? data.summary.starred_slugs
            : (data.summary && Array.isArray(data.summary.starred_details))
              ? data.summary.starred_details
              : [];
        const notesObj = data.notes || data.userNotes || {};
        const draftsObj = data.drafts || {};

        const solvedCount = solvedList.length;
        const attemptedCount = attemptedList.length;
        const starredCount = starredList.length;
        const notesCount = Object.keys(notesObj).length;
        const draftsCount = Object.keys(draftsObj).length;

        const fileNameEl = el("restore-file-name");
        if (fileNameEl) fileNameEl.textContent = file.name;

        const fileTypeEl = el("restore-file-type");
        if (fileTypeEl) {
          fileTypeEl.textContent = isFull ? "Full Backup (v2)" : "Compact Progress Backup";
          fileTypeEl.className = isFull ? "badge-tag-rec" : "badge-tag-subtle";
        }

        const fileDateEl = el("restore-file-date");
        if (fileDateEl) {
          fileDateEl.textContent = data.exported_at
            ? "Exported: " + new Date(data.exported_at).toLocaleString()
            : "Export date: Unknown";
        }

        const countSolvedEl = el("restore-count-solved");
        if (countSolvedEl) countSolvedEl.textContent = solvedCount;

        const countAttemptedEl = el("restore-count-attempted");
        if (countAttemptedEl) countAttemptedEl.textContent = attemptedCount;

        const countStarredEl = el("restore-count-starred");
        if (countStarredEl) countStarredEl.textContent = starredCount;

        const countNotesEl = el("restore-count-notes");
        if (countNotesEl) countNotesEl.textContent = notesCount;

        const countDraftsEl = el("restore-count-drafts");
        if (countDraftsEl) countDraftsEl.textContent = draftsCount;

        const dropInfo = el("dropzone-file-info");
        if (dropInfo) {
          dropInfo.style.display = "flex";
          dropInfo.innerHTML = `
            <div class="dropzone-file-meta">
              <div class="dropzone-file-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Ready to Restore: <strong>${escapeHTML(file.name)}</strong> (${formatBytes(file.size)})</span>
              </div>
              <div class="dropzone-file-badges">
                <span class="badge-tag-rec">${isFull ? "Full Backup" : "Compact Progress"}</span>
                <span class="badge-tag-subtle">${solvedCount} Solved</span>
                <span class="badge-tag-subtle">${draftsCount} Drafts</span>
                <span class="badge-tag-subtle">${starredCount} Starred</span>
                <span class="badge-tag-subtle">${notesCount} Notes</span>
              </div>
            </div>
            <div class="dropzone-actions">
              <button id="btn-quick-restore-merge" class="btn-sm btn-primary">Restore (Merge)</button>
              <button id="btn-quick-restore-replace" class="btn-sm btn-ghost text-danger">Replace All</button>
              <button id="btn-open-restore-preview" class="btn-sm btn-secondary">Review Dialog</button>
            </div>
          `;

          el("btn-quick-restore-merge")?.addEventListener("click", () => {
            Storage.applyRestoreData(data, "merge");
          });
          el("btn-quick-restore-replace")?.addEventListener("click", () => {
            if (confirm("Replace all local data with this backup? Current unsaved drafts will be overwritten.")) {
              Storage.applyRestoreData(data, "replace");
            }
          });
          el("btn-open-restore-preview")?.addEventListener("click", () => {
            const m = el("restore-modal");
            if (m) {
              m.classList.add("active");
              m.style.display = "flex";
            }
          });
        }

        const modal = el("restore-modal");
        if (modal) {
          modal.classList.add("active");
          modal.style.display = "flex";
        }

        showToast(`Backup loaded: ${file.name} (${solvedCount} solved, ${draftsCount} drafts). Click 'Apply Restore' to confirm.`);
      } catch (err) {
        console.error("Backup parse error:", err);
        showToast("Error reading backup file: " + err.message);
      } finally {
        if (e.target && "value" in e.target) {
          e.target.value = "";
        }
      }
    };
    reader.readAsText(file);
  },

  closeRestoreModal() {
    const modal = el("restore-modal");
    if (modal) {
      modal.classList.remove("active");
      modal.style.display = "none";
    }
  },

  handleApplyRestore() {
    if (!pendingRestoreData) {
      showToast("No backup file loaded to restore");
      return;
    }
    const mode = document.querySelector('input[name="restore-mode"]:checked')?.value || "merge";
    Storage.applyRestoreData(pendingRestoreData.data, mode);
    SettingsPage.closeRestoreModal();
  }
};
