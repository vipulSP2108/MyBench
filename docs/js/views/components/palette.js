/**
 * Command Palette
 * Global quick-search (Ctrl/Cmd + K) over questions, pages and actions.
 */

import { state, isQuestionSolved, isQuestionAttempted } from "../../models/state.js";
import { el, escapeHTML } from "../../utils.js";
import { getDailyChallenge, topicsOf } from "../pages/home_page.js";

let items = [];
let active = 0;

function score(hay, q) {
  if (!q) return 1;
  const h = hay.toLowerCase();
  const i = h.indexOf(q);
  if (i >= 0) return 100 - i + (i === 0 ? 40 : 0);
  // ordered-subsequence fallback
  let pos = 0;
  for (const ch of q) {
    pos = h.indexOf(ch, pos);
    if (pos === -1) return 0;
    pos++;
  }
  return 10;
}

function actionItems() {
  return [
    { kind: "action", title: "Go to Home", hint: "Page", run: () => state.emit("switchView", "home") },
    { kind: "action", title: "Open Progress Insights", hint: "Page", run: () => state.emit("switchView", "insights") },
    { kind: "action", title: "Open My Notes", hint: "Page", run: () => state.emit("switchView", "notes") },
    { kind: "action", title: "Open Settings", hint: "Page", run: () => state.emit("switchView", "settings") },
    { kind: "action", title: "Pick a random question", hint: "Action", run: () => {
      const r = state.questions[Math.floor(Math.random() * state.questions.length)];
      if (r) state.emit("navigateToQuestion", r.slug);
    } },
    { kind: "action", title: "Open today's daily challenge", hint: "Action", run: () => {
      const d = getDailyChallenge();
      if (d) state.emit("navigateToQuestion", d.slug);
    } },
    { kind: "action", title: "Toggle light / dark theme", hint: "Action", run: () => el("btn-theme-toggle")?.click() }
  ];
}

function buildResults(raw) {
  const q = raw.trim().toLowerCase();
  const out = [];
  for (const a of actionItems()) {
    const s = score(a.title, q);
    if (s) out.push({ ...a, s: s + (q ? 0 : -50) });
  }
  for (const qu of state.questions) {
    const topics = topicsOf(qu).map(t => t.label).join(" ");
    const hay = `${qu.title} ${qu.company || ""} ${qu.difficulty} ${(qu.tags || []).join(" ")} ${topics}`;
    const s = score(hay, q);
    if (!s) continue;
    out.push({ kind: "question", q: qu, title: qu.title, s: s + (qu.title.toLowerCase().startsWith(q) && q ? 30 : 0) });
  }
  out.sort((a, b) => b.s - a.s);
  return out.slice(0, q ? 30 : 14);
}

function render() {
  const list = el("palette-list");
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<div class="palette-empty">No matches. Try a company, topic or question title.</div>`;
    return;
  }
  list.innerHTML = items.map((it, i) => {
    if (it.kind === "action") {
      return `<div class="palette-item ${i === active ? "active" : ""}" role="option" data-i="${i}">
        <span class="palette-ico">⚡</span><span class="palette-title">${escapeHTML(it.title)}</span><span class="palette-hint">${it.hint}</span></div>`;
    }
    const q = it.q;
    const status = isQuestionSolved(q.slug) ? "✓" : isQuestionAttempted(q.slug) ? "●" : "○";
    const cls = isQuestionSolved(q.slug) ? "solved" : isQuestionAttempted(q.slug) ? "attempted" : "";
    return `<div class="palette-item ${i === active ? "active" : ""}" role="option" data-i="${i}">
      <span class="palette-ico status ${cls}">${status}</span>
      <span class="palette-title">${escapeHTML(q.title)}</span>
      <span class="palette-hint">${escapeHTML(q.company || "General")}</span>
      <span class="doc-diff-pill ${q.difficulty.toLowerCase()}">${q.difficulty}</span></div>`;
  }).join("");
  list.querySelectorAll(".palette-item").forEach(node => {
    node.addEventListener("mousemove", () => { active = +node.dataset.i; highlight(); });
    node.addEventListener("click", () => choose(+node.dataset.i));
  });
  highlight();
}

function highlight() {
  const list = el("palette-list");
  list?.querySelectorAll(".palette-item").forEach((n, i) => n.classList.toggle("active", i === active));
  list?.querySelector(".palette-item.active")?.scrollIntoView({ block: "nearest" });
}

function choose(i) {
  const it = items[i];
  if (!it) return;
  PaletteComponent.close();
  if (it.kind === "action") it.run();
  else state.emit("navigateToQuestion", it.q.slug);
}

export const PaletteComponent = {
  isOpen() {
    return el("palette-backdrop")?.style.display === "flex";
  },

  open() {
    const bd = el("palette-backdrop");
    const input = el("palette-input");
    if (!bd || !input) return;
    bd.style.display = "flex";
    input.value = "";
    active = 0;
    items = buildResults("");
    render();
    setTimeout(() => input.focus(), 0);
  },

  close() {
    const bd = el("palette-backdrop");
    if (bd) bd.style.display = "none";
  },

  init() {
    const bd = el("palette-backdrop");
    const input = el("palette-input");
    if (!bd || !input || bd._bound) return;
    bd._bound = true;

    input.addEventListener("input", () => {
      active = 0;
      items = buildResults(input.value);
      render();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(items.length - 1, active + 1); highlight(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); highlight(); }
      else if (e.key === "Enter") { e.preventDefault(); choose(active); }
      else if (e.key === "Escape") { e.preventDefault(); PaletteComponent.close(); }
    });
    bd.addEventListener("mousedown", (e) => { if (e.target === bd) PaletteComponent.close(); });

    window.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        PaletteComponent.isOpen() ? PaletteComponent.close() : PaletteComponent.open();
      }
    }, true);

    window.addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || state.editor?.hasFocus?.()) return;
      if (state.currentView !== "home") return;
      e.preventDefault();
      el("home-sheet-search")?.focus();
    });

    el("home-btn-palette")?.addEventListener("click", () => PaletteComponent.open());
  }
};
