/**
 * Insights Page
 * Progress overview: topic mastery, difficulty and company coverage,
 * a 20-week activity heatmap and suggested next questions.
 */

import { state } from "../../models/state.js";
import { Activity, dayKey } from "../../models/activity.js";
import { HomePage } from "./home_page.js";
import { el, escapeHTML } from "../../utils.js";

const bar = (pct, cls = "") => `<span class="ins-bar"><i class="${cls}" style="width:${Math.round(pct * 100)}%"></i></span>`;

export const InsightsPage = {
  render() {
    const qs = state.questions;
    if (!qs.length) return;
    const total = qs.length;
    const solved = qs.filter(q => state.solvedSlugs.has(q.slug)).length;
    const attempted = qs.filter(q => !state.solvedSlugs.has(q.slug) && state.attemptedSlugs.has(q.slug)).length;

    el("ins-sub").textContent = solved === 0
      ? "Solve your first question and this page fills in."
      : `${solved} of ${total} solved, ${total - solved} to go.`;

    el("ins-stats").innerHTML = [
      [`${solved}/${total}`, "Solved"],
      [attempted, "In progress"],
      [Activity.currentStreak(), "Day streak"],
      [Activity.solvesInLastDays(7), "Solved this week"]
    ].map(([v, l]) => `<div class="ins-stat"><b>${v}</b><span>${l}</span></div>`).join("");

    // Topics (weakest first so gaps are obvious)
    const topics = HomePage.topicStats().sort((a, b) => a.pct - b.pct);
    el("ins-topics").innerHTML = topics.map(t => `
      <div class="ins-row" data-topic="${t.id}"><span class="ins-name">${t.label}</span>${bar(t.pct)}<span class="ins-num">${t.solved}/${t.total}</span></div>`).join("");
    el("ins-topics").querySelectorAll(".ins-row").forEach(r => r.onclick = () => {
      state.homeTag = r.dataset.topic;
      state.emit("switchView", "home");
    });

    // Difficulty
    el("ins-diff").innerHTML = ["Easy", "Medium", "Hard"].map(d => {
      const all = qs.filter(q => q.difficulty === d);
      const done = all.filter(q => state.solvedSlugs.has(q.slug)).length;
      return `<div class="ins-row" style="cursor:default"><span>${d}</span>${bar(all.length ? done / all.length : 0, d.toLowerCase())}<span class="ins-num">${done}/${all.length}</span></div>`;
    }).join("");

    // Companies
    const byCo = {};
    qs.forEach(q => {
      const c = q.company || "General";
      (byCo[c] = byCo[c] || { n: 0, s: 0 }).n++;
      if (state.solvedSlugs.has(q.slug)) byCo[c].s++;
    });
    el("ins-companies").innerHTML = Object.entries(byCo).sort((a, b) => b[1].n - a[1].n).slice(0, 6).map(([c, v]) =>
      `<div class="ins-row" style="cursor:default"><span>${escapeHTML(c)}</span>${bar(v.s / v.n)}<span class="ins-num">${v.s}/${v.n}</span></div>`).join("");

    // Heatmap: 20 weeks, columns are weeks (Sun-Sat), ending with the current week
    const data = Activity.all();
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - end.getDay() - 19 * 7);
    let cells = "";
    for (let i = 0; i < 20 * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d > end) { cells += `<i style="visibility:hidden"></i>`; continue; }
      const a = data[dayKey(d)];
      const n = a ? a.runs + a.submits + a.solves : 0;
      const lvl = n === 0 ? "" : n < 4 ? "l1" : n < 10 ? "l2" : "l3";
      cells += `<i class="${lvl}" title="${dayKey(d)}: ${n} action${n === 1 ? "" : "s"}"></i>`;
    }
    el("ins-heat").innerHTML = cells;

    // Suggested next: easiest unsolved question in each of the weakest topics
    const rank = { Easy: 1, Medium: 2, Hard: 3 };
    const picks = [];
    for (const t of topics.filter(t => t.solved < t.total)) {
      const q = t.questions.filter(x => !state.solvedSlugs.has(x.slug) && !picks.some(p => p.q.slug === x.slug))
        .sort((a, b) => rank[a.difficulty] - rank[b.difficulty])[0];
      if (q) picks.push({ q, t });
      if (picks.length === 4) break;
    }
    el("ins-next").innerHTML = picks.length ? picks.map(({ q, t }) =>
      `<button data-slug="${q.slug}"><span>${escapeHTML(q.title)}<br><small>${t.label} · ${q.difficulty}</small></span><span>→</span></button>`).join("")
      : `<small>Everything is solved.</small>`;
    el("ins-next").querySelectorAll("button").forEach(b => b.onclick = () => state.emit("navigateToQuestion", b.dataset.slug));
  }
};
