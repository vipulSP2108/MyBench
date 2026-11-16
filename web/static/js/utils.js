/**
 * Shared DOM and Formatting Utilities
 */

export function el(id) {
  return document.getElementById(id);
}

export function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

export function showToast(msg) {
  const toast = el("toast-notification");
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = "block";
  toast.classList.add("visible");
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => {
      toast.style.display = "none";
    }, 300);
  }, 2200);
}
