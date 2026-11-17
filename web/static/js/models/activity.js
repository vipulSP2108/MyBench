/**
 * Activity Model
 * Records real practice activity per local calendar day and derives streaks.
 * Stored in localStorage as { "YYYY-MM-DD": { runs, submits, solves } }.
 */

const KEY = "sqlmaster_activity";

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}

function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
}

export const Activity = {
  KEY,

  /** type: "run" | "submit" | "solve" */
  log(type) {
    const data = read();
    const k = dayKey();
    const day = data[k] || { runs: 0, submits: 0, solves: 0 };
    if (type === "run") day.runs++;
    else if (type === "submit") day.submits++;
    else if (type === "solve") day.solves++;
    data[k] = day;
    write(data);
  },

  all() { return read(); },

  isActive(key) {
    const d = read()[key];
    return !!d && (d.runs + d.submits + d.solves) > 0;
  },

  /** Current streak: consecutive active days ending today (or yesterday, so the streak survives until midnight). */
  currentStreak() {
    const data = read();
    const cursor = new Date();
    const active = (dt) => {
      const d = data[dayKey(dt)];
      return !!d && (d.runs + d.submits + d.solves) > 0;
    };
    if (!active(cursor)) cursor.setDate(cursor.getDate() - 1);
    let n = 0;
    while (active(cursor)) {
      n++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  },

  longestStreak() {
    const keys = Object.keys(read()).filter(k => Activity.isActive(k)).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      const dt = new Date(k + "T00:00:00");
      if (prev && Math.round((dt - prev) / 86400000) === 1) run++;
      else run = 1;
      best = Math.max(best, run);
      prev = dt;
    }
    return best;
  },

  solvesInLastDays(days) {
    const data = read();
    const cursor = new Date();
    let total = 0;
    for (let i = 0; i < days; i++) {
      total += (data[dayKey(cursor)]?.solves || 0);
      cursor.setDate(cursor.getDate() - 1);
    }
    return total;
  },

  clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
};
