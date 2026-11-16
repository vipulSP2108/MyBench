/**
 * SQL CodeMirror Editor & Autocomplete Component
 */

import { state } from "../../models/state.js";
import { NavbarComponent } from "./navbar.js";
import { el, showToast } from "../../utils.js";

const SQL_AUTOCOMPLETE_FUNCTIONS = [
  { text: "CONCAT()", insert: "CONCAT()", cursorOffset: -1, type: "func", desc: "Concatenate strings" },
  { text: "COUNT()", insert: "COUNT()", cursorOffset: -1, type: "func", desc: "Count rows or values" },
  { text: "ROUND()", insert: "ROUND()", cursorOffset: -1, type: "func", desc: "Round to N decimals" },
  { text: "DATE_FORMAT()", insert: "DATE_FORMAT()", cursorOffset: -1, type: "func", desc: "Format date" },
  { text: "COALESCE()", insert: "COALESCE()", cursorOffset: -1, type: "func", desc: "First non-null value" },
  { text: "SUM()", insert: "SUM()", cursorOffset: -1, type: "func", desc: "Sum numeric column" },
  { text: "AVG()", insert: "AVG()", cursorOffset: -1, type: "func", desc: "Average numeric column" },
  { text: "MIN()", insert: "MIN()", cursorOffset: -1, type: "func", desc: "Minimum value" },
  { text: "MAX()", insert: "MAX()", cursorOffset: -1, type: "func", desc: "Maximum value" },
  { text: "DENSE_RANK() OVER ()", insert: "DENSE_RANK() OVER ()", cursorOffset: -1, type: "func", desc: "Rank without gaps" },
  { text: "ROW_NUMBER() OVER ()", insert: "ROW_NUMBER() OVER ()", cursorOffset: -1, type: "func", desc: "Sequential row number" },
  { text: "RANK() OVER ()", insert: "RANK() OVER ()", cursorOffset: -1, type: "func", desc: "Rank with gaps" },
  { text: "LAG() OVER ()", insert: "LAG() OVER ()", cursorOffset: -1, type: "func", desc: "Access preceding row" },
  { text: "LEAD() OVER ()", insert: "LEAD() OVER ()", cursorOffset: -1, type: "func", desc: "Access following row" },
  { text: "IFNULL()", insert: "IFNULL()", cursorOffset: -1, type: "func", desc: "Replace null with value" },
  { text: "NULLIF()", insert: "NULLIF()", cursorOffset: -1, type: "func", desc: "Null if expressions equal" },
  { text: "SUBSTRING()", insert: "SUBSTRING()", cursorOffset: -1, type: "func", desc: "Extract substring" },
  { text: "TRIM()", insert: "TRIM()", cursorOffset: -1, type: "func", desc: "Strip whitespace" },
  { text: "UPPER()", insert: "UPPER()", cursorOffset: -1, type: "func", desc: "Convert to uppercase" },
  { text: "LOWER()", insert: "LOWER()", cursorOffset: -1, type: "func", desc: "Convert to lowercase" },
  { text: "REPLACE()", insert: "REPLACE()", cursorOffset: -1, type: "func", desc: "Replace substrings" },
  { text: "CAST()", insert: "CAST( AS )", cursorOffset: -6, type: "func", desc: "Convert data type" },
  { text: "EXTRACT()", insert: "EXTRACT( FROM )", cursorOffset: -6, type: "func", desc: "Extract date field" },
  { text: "YEAR()", insert: "YEAR()", cursorOffset: -1, type: "func", desc: "Extract year integer" },
  { text: "MONTH()", insert: "MONTH()", cursorOffset: -1, type: "func", desc: "Extract month integer" },
  { text: "DAY()", insert: "DAY()", cursorOffset: -1, type: "func", desc: "Extract day integer" },
  { text: "DATEDIFF()", insert: "DATEDIFF()", cursorOffset: -1, type: "func", desc: "Days between dates" },
  { text: "DATE_ADD()", insert: "DATE_ADD(, INTERVAL 1 DAY)", cursorOffset: -18, type: "func", desc: "Add date interval" },
  { text: "DATE_SUB()", insert: "DATE_SUB(, INTERVAL 1 DAY)", cursorOffset: -18, type: "func", desc: "Subtract date interval" },
  { text: "ABS()", insert: "ABS()", cursorOffset: -1, type: "func", desc: "Absolute value" },
  { text: "CEIL()", insert: "CEIL()", cursorOffset: -1, type: "func", desc: "Ceiling integer" },
  { text: "FLOOR()", insert: "FLOOR()", cursorOffset: -1, type: "func", desc: "Floor integer" },
  { text: "POWER()", insert: "POWER()", cursorOffset: -1, type: "func", desc: "Exponential power" },
  { text: "SQRT()", insert: "SQRT()", cursorOffset: -1, type: "func", desc: "Square root" },
  { text: "NTILE() OVER ()", insert: "NTILE() OVER ()", cursorOffset: -1, type: "func", desc: "Divide ordered rows" },
  { text: "FIRST_VALUE() OVER ()", insert: "FIRST_VALUE() OVER ()", cursorOffset: -1, type: "func", desc: "First window value" },
  { text: "LAST_VALUE() OVER ()", insert: "LAST_VALUE() OVER ()", cursorOffset: -1, type: "func", desc: "Last window value" },
  { text: "NOW()", insert: "NOW()", cursorOffset: 0, type: "func", desc: "Current timestamp" },
  { text: "CURDATE()", insert: "CURDATE()", cursorOffset: 0, type: "func", desc: "Current date" }
];

const SQL_AUTOCOMPLETE_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT",
  "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "CROSS JOIN", "ON",
  "AS", "AND", "OR", "NOT", "IN", "NOT IN", "EXISTS", "NOT EXISTS",
  "BETWEEN", "UNION", "UNION ALL", "WITH", "DISTINCT", "CASE", "WHEN",
  "THEN", "ELSE", "END", "OVER", "PARTITION BY", "DESC", "ASC",
  "IS NULL", "IS NOT NULL", "LIKE", "ILIKE", "OFFSET"
];

let autocompleteState = {
  isOpen: false,
  selectedIndex: 0,
  suggestions: [],
  prefixInfo: null
};

function escapeSqlHint(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getOrCreateAutocompletePopup() {
  let popup = el("editor-autocomplete-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "editor-autocomplete-popup";
    popup.className = "editor-autocomplete-popup";
    popup.style.display = "none";
    document.body.appendChild(popup);
  }
  return popup;
}

function isAutocompleteOpen() {
  const popup = el("editor-autocomplete-popup");
  return popup && popup.style.display !== "none" && autocompleteState.isOpen && autocompleteState.suggestions.length > 0;
}

function closeAutocompletePopup() {
  autocompleteState.isOpen = false;
  autocompleteState.suggestions = [];
  autocompleteState.prefixInfo = null;
  autocompleteState.selectedIndex = 0;
  const popup = el("editor-autocomplete-popup");
  if (popup) {
    popup.style.display = "none";
    popup.innerHTML = "";
  }
}

function getAutocompletePrefix(cm) {
  const cur = cm.getCursor();
  const line = cm.getLine(cur.line);
  let startCh = cur.ch;
  while (startCh > 0 && /[a-zA-Z0-9_]/.test(line.charAt(startCh - 1))) {
    startCh--;
  }
  const prefix = line.slice(startCh, cur.ch);

  let qualifier = null;
  if (startCh > 0 && line.charAt(startCh - 1) === ".") {
    let qStart = startCh - 1;
    while (qStart > 0 && /[a-zA-Z0-9_]/.test(line.charAt(qStart - 1))) {
      qStart--;
    }
    if (qStart < startCh - 1) {
      qualifier = line.slice(qStart, startCh - 1);
    }
  }

  return { prefix, startCh, endCh: cur.ch, line: cur.line, qualifier };
}

function scoreAutocompleteMatch(target, query, freq = 0) {
  const t = target.toLowerCase();
  const q = (query || "").toLowerCase();
  if (!q) return 10 + freq * 20;

  if (t === q) return 1000 + freq * 30;
  if (t.startsWith(q)) return 800 + (60 - Math.min(50, t.length)) + freq * 35;
  if (q.length >= 2 && t.includes(q)) return 500 + (30 - Math.min(25, t.indexOf(q))) + freq * 20;

  const dedupQ = q.replace(/(.)\1+/g, "$1");
  if (dedupQ.length >= 2 && t.startsWith(dedupQ)) return 450 + (40 - Math.min(30, t.length)) + freq * 25;
  if (dedupQ.length >= 2 && t.includes(dedupQ)) return 400 + freq * 20;

  if (q.length >= 3) {
    const tPrefix = t.slice(0, Math.min(t.length, q.length));
    let diff = 0;
    for (let i = 0; i < Math.min(tPrefix.length, q.length); i++) {
      if (tPrefix[i] !== q[i]) diff++;
    }
    diff += Math.abs(tPrefix.length - q.length);
    if (diff <= 1 && t.length >= q.length - 1) return 350 + freq * 20;

    let ti = 0, qi = 0;
    while (ti < t.length && qi < q.length) {
      if (t[ti] === q[qi]) qi++;
      ti++;
    }
    if (qi === q.length) return 300 + freq * 15;
  }

  return 0;
}

function highlightAutocompleteMatch(target, query) {
  const t = target;
  const tLower = target.toLowerCase();
  const qLower = (query || "").toLowerCase();
  if (!qLower) return escapeSqlHint(t);

  if (tLower.startsWith(qLower)) {
    const matched = t.slice(0, query.length);
    const rest = t.slice(query.length);
    return `<strong class="ac-match">${escapeSqlHint(matched)}</strong>${escapeSqlHint(rest)}`;
  }

  const dedupQ = qLower.replace(/(.)\1+/g, "$1");
  if (dedupQ.length >= 2 && tLower.startsWith(dedupQ)) {
    const matched = t.slice(0, dedupQ.length);
    const rest = t.slice(dedupQ.length);
    return `<strong class="ac-match">${escapeSqlHint(matched)}</strong>${escapeSqlHint(rest)}`;
  }

  const idx = tLower.indexOf(qLower);
  if (idx !== -1) {
    const before = t.slice(0, idx);
    const matched = t.slice(idx, idx + query.length);
    const after = t.slice(idx + query.length);
    return `${escapeSqlHint(before)}<strong class="ac-match">${escapeSqlHint(matched)}</strong>${escapeSqlHint(after)}`;
  }

  let matchLen = 0;
  while (matchLen < t.length && matchLen < query.length && tLower[matchLen] === qLower[matchLen]) {
    matchLen++;
  }
  if (matchLen > 0) {
    return `<strong class="ac-match">${escapeSqlHint(t.slice(0, matchLen))}</strong>${escapeSqlHint(t.slice(matchLen))}`;
  }

  return escapeSqlHint(t);
}

function resolveTableForQualifier(qualifier, editorContent, tables) {
  if (!qualifier || !tables || tables.length === 0) return null;
  const qLower = qualifier.toLowerCase();

  for (const tbl of tables) {
    if (tbl.table_name && tbl.table_name.toLowerCase() === qLower) return tbl;
  }

  const aliasRegex = /(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)(?:\s+AS)?\s+([a-zA-Z0-9_]+)/gi;
  let match;
  while ((match = aliasRegex.exec(editorContent)) !== null) {
    const rawTbl = match[1].toLowerCase();
    const rawAlias = match[2].toLowerCase();
    if (["on", "where", "join", "left", "right", "inner", "cross", "group", "order", "limit"].includes(rawAlias)) continue;
    if (rawAlias === qLower) {
      const found = tables.find(t => t.table_name && t.table_name.toLowerCase() === rawTbl);
      if (found) return found;
    }
  }

  for (const tbl of tables) {
    const tName = (tbl.table_name || "").toLowerCase();
    if (tName.startsWith(qLower)) return tbl;
    const initials = tName.split("_").map(part => part[0]).join("");
    if (initials === qLower) return tbl;
  }

  if (tables.length === 1) return tables[0];
  return null;
}

function getAutocompleteSuggestions(cm, prefixInfo, isManualTrigger) {
  const info = typeof prefixInfo === "string" ? { prefix: prefixInfo } : (prefixInfo || {});
  const prefix = info.prefix || "";
  const qualifier = info.qualifier || null;
  const lowerPrefix = prefix.toLowerCase();

  const isTestMode = state.plainMode || state.settings.autocompleteMode === "editor_only";
  const isOff = state.settings.autocompleteMode === "off";
  if (isOff) return [];

  const suggestions = [];
  const seenTexts = new Set();

  const editorContent = cm.getValue();
  const allWords = editorContent.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  const wordFrequency = {};
  for (const w of allWords) {
    wordFrequency[w] = (wordFrequency[w] || 0) + 1;
    wordFrequency[w.toLowerCase()] = (wordFrequency[w.toLowerCase()] || 0) + 1;
  }

  if (isTestMode) {
    const uniqueWords = Array.from(new Set(allWords));
    for (const w of uniqueWords) {
      if (w.toLowerCase() === lowerPrefix && w.length === lowerPrefix.length) continue;
      if (qualifier && w.toLowerCase() === qualifier.toLowerCase()) continue;
      const freq = wordFrequency[w] || 1;
      const score = scoreAutocompleteMatch(w, prefix, freq);
      if (score > 0) {
        suggestions.push({
          text: w,
          insert: w,
          type: "editor",
          typeIcon: "abc",
          badge: "",
          highlightedHtml: highlightAutocompleteMatch(w, prefix),
          score: score
        });
      }
    }
    suggestions.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
    return suggestions.slice(0, 15);
  }

  if (qualifier && state.currentQuestion) {
    const tables = state.currentQuestion.tables || [];
    const matchedTable = resolveTableForQualifier(qualifier, editorContent, tables);
    const targetTables = matchedTable ? [matchedTable] : tables;

    for (const tbl of targetTables) {
      for (const col of (tbl.columns || [])) {
        const colName = col.column_name;
        if (!colName || seenTexts.has(colName.toLowerCase())) continue;
        const freq = wordFrequency[colName.toLowerCase()] || 0;
        const score = !prefix ? 900 : scoreAutocompleteMatch(colName, prefix, freq) + 50;
        if (score > 0) {
          suggestions.push({
            text: colName,
            insert: colName,
            type: "column",
            typeIcon: "abc",
            badge: "COL",
            highlightedHtml: highlightAutocompleteMatch(colName, prefix),
            score: score
          });
          seenTexts.add(colName.toLowerCase());
        }
      }
    }

    if (suggestions.length > 0) {
      suggestions.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
      return suggestions.slice(0, 15);
    }
  }

  for (const fn of SQL_AUTOCOMPLETE_FUNCTIONS) {
    const nameOnly = fn.text.replace(/\(.*$/, "");
    const freq = wordFrequency[nameOnly.toLowerCase()] || 0;
    const score = scoreAutocompleteMatch(nameOnly, prefix, freq) + 20;
    if (score > 20) {
      suggestions.push({
        text: fn.text,
        insert: fn.insert,
        cursorOffset: fn.cursorOffset,
        type: "func",
        typeIcon: "fn",
        badge: "FUNC",
        desc: fn.desc,
        highlightedHtml: highlightAutocompleteMatch(fn.text, prefix),
        score: score
      });
      seenTexts.add(nameOnly.toUpperCase());
    }
  }

  if (state.currentQuestion) {
    const tables = state.currentQuestion.tables || [];
    for (const tbl of tables) {
      const tblName = tbl.table_name;
      if (tblName && !seenTexts.has(tblName.toLowerCase())) {
        const freq = wordFrequency[tblName.toLowerCase()] || 0;
        const score = scoreAutocompleteMatch(tblName, prefix, freq) + 15;
        if (score > 15) {
          suggestions.push({
            text: tblName,
            insert: tblName,
            type: "table",
            typeIcon: "tbl",
            badge: "TABLE",
            highlightedHtml: highlightAutocompleteMatch(tblName, prefix),
            score: score
          });
          seenTexts.add(tblName.toLowerCase());
        }
      }
      for (const col of (tbl.columns || [])) {
        const colName = col.column_name;
        if (colName && !seenTexts.has(colName.toLowerCase())) {
          const freq = wordFrequency[colName.toLowerCase()] || 0;
          const score = scoreAutocompleteMatch(colName, prefix, freq) + 15;
          if (score > 15) {
            suggestions.push({
              text: colName,
              insert: colName,
              type: "column",
              typeIcon: "abc",
              badge: "COL",
              highlightedHtml: highlightAutocompleteMatch(colName, prefix),
              score: score
            });
            seenTexts.add(colName.toLowerCase());
          }
        }
      }
    }
  }

  for (const kw of SQL_AUTOCOMPLETE_KEYWORDS) {
    if (!seenTexts.has(kw) && !seenTexts.has(kw.toLowerCase())) {
      const freq = wordFrequency[kw.toLowerCase()] || 0;
      const score = scoreAutocompleteMatch(kw, prefix, freq);
      if (score > 0) {
        suggestions.push({
          text: kw,
          insert: kw + " ",
          type: "keyword",
          typeIcon: "kw",
          badge: "KW",
          highlightedHtml: highlightAutocompleteMatch(kw, prefix),
          score: score
        });
        seenTexts.add(kw);
      }
    }
  }

  for (const w of Array.from(new Set(allWords))) {
    if (w.toLowerCase() === lowerPrefix && w.length === lowerPrefix.length) continue;
    if (!seenTexts.has(w) && !seenTexts.has(w.toUpperCase()) && !seenTexts.has(w.toLowerCase())) {
      const freq = wordFrequency[w] || 1;
      const score = scoreAutocompleteMatch(w, prefix, freq);
      if (score > 0) {
        suggestions.push({
          text: w,
          insert: w,
          type: "editor",
          typeIcon: "abc",
          badge: "BUFFER",
          highlightedHtml: highlightAutocompleteMatch(w, prefix),
          score: score
        });
        seenTexts.add(w.toLowerCase());
      }
    }
  }

  suggestions.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
  return suggestions.slice(0, 15);
}

function updateAutocompletePosition(cm) {
  const popup = el("editor-autocomplete-popup");
  if (!popup || !cm) return;
  const coords = cm.cursorCoords(true, "page");

  let left = coords.left;
  let top = coords.bottom + 4;

  if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
  if (top + 220 > window.innerHeight) top = Math.max(10, coords.top - 225);

  popup.style.left = `${Math.max(10, left)}px`;
  popup.style.top = `${Math.max(10, top)}px`;
}

function renderAutocompletePopup(cm, suggestions, prefixInfo) {
  const popup = getOrCreateAutocompletePopup();
  autocompleteState.isOpen = true;
  autocompleteState.suggestions = suggestions;
  autocompleteState.prefixInfo = prefixInfo;
  autocompleteState.selectedIndex = 0;

  popup.innerHTML = "";
  const isTestMode = state.plainMode || state.settings.autocompleteMode === "editor_only";
  suggestions.forEach((item, index) => {
    const itemEl = document.createElement("div");
    itemEl.className = `autocomplete-item${index === 0 ? " active" : ""}`;
    itemEl.dataset.index = index;

    const iconHtml = `<span class="ac-icon">${escapeSqlHint(item.typeIcon || "abc")}</span>`;
    const textHtml = `<span class="autocomplete-item-text">${item.highlightedHtml || escapeSqlHint(item.text)}</span>`;
    const badgeHtml = item.badge && !isTestMode ? `<span class="autocomplete-badge badge-${item.type}">${escapeSqlHint(item.badge)}</span>` : "";

    itemEl.innerHTML = `
      <div class="autocomplete-item-main">
        ${iconHtml}
        ${textHtml}
      </div>
      ${badgeHtml}
    `;

    itemEl.addEventListener("mouseenter", () => {
      autocompleteState.selectedIndex = index;
      updateAutocompleteActiveHighlight();
    });

    itemEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyAutocompleteItem(cm, item, prefixInfo);
    });

    popup.appendChild(itemEl);
  });

  updateAutocompletePosition(cm);
  popup.style.display = "flex";
}

function updateAutocompleteActiveHighlight() {
  const popup = el("editor-autocomplete-popup");
  if (!popup) return;
  const items = popup.querySelectorAll(".autocomplete-item");
  items.forEach((it, idx) => {
    if (idx === autocompleteState.selectedIndex) {
      it.classList.add("active");
      it.scrollIntoView({ block: "nearest" });
    } else {
      it.classList.remove("active");
    }
  });
}

function moveAutocompleteSelection(dir) {
  if (!autocompleteState.isOpen || autocompleteState.suggestions.length === 0) return;
  const total = autocompleteState.suggestions.length;
  autocompleteState.selectedIndex = (autocompleteState.selectedIndex + dir + total) % total;
  updateAutocompleteActiveHighlight();
}

function applySelectedAutocomplete(cm) {
  if (!autocompleteState.isOpen || autocompleteState.suggestions.length === 0) return;
  const item = autocompleteState.suggestions[autocompleteState.selectedIndex];
  if (item) {
    applyAutocompleteItem(cm, item, autocompleteState.prefixInfo);
  }
}

function applyAutocompleteItem(cm, item, prefixInfo) {
  if (!cm || !item) return;
  const info = prefixInfo || getAutocompletePrefix(cm);

  const from = { line: info.line, ch: info.startCh };
  const to = { line: info.line, ch: info.endCh };

  cm.replaceRange(item.insert, from, to);

  if (typeof item.cursorOffset === "number" && item.cursorOffset < 0) {
    const newCh = info.startCh + item.insert.length + item.cursorOffset;
    cm.setCursor({ line: info.line, ch: Math.max(0, newCh) });
  } else {
    cm.setCursor({ line: info.line, ch: info.startCh + item.insert.length });
  }

  closeAutocompletePopup();
  cm.focus();
}

function handleAutocompleteInput(cm) {
  if (state.settings.autocompleteMode === "off") {
    closeAutocompletePopup();
    return;
  }
  const prefixInfo = getAutocompletePrefix(cm);
  if (!prefixInfo.prefix && !prefixInfo.qualifier) {
    closeAutocompletePopup();
    return;
  }
  const suggestions = getAutocompleteSuggestions(cm, prefixInfo, false);
  if (suggestions.length === 0) {
    closeAutocompletePopup();
    return;
  }
  renderAutocompletePopup(cm, suggestions, prefixInfo);
}

function triggerAutocomplete(cm, isManual) {
  if (!cm) cm = state.editor;
  if (!cm) return;

  if (state.settings.autocompleteMode === "off") {
    if (isManual) showToast("Autocomplete is disabled in Settings");
    closeAutocompletePopup();
    return;
  }

  const prefixInfo = getAutocompletePrefix(cm);
  const suggestions = getAutocompleteSuggestions(cm, prefixInfo, isManual);
  if (suggestions.length === 0) {
    if (isManual) {
      const isTest = state.plainMode || state.settings.autocompleteMode === "editor_only";
      showToast(isTest ? "No words in editor buffer match" : "No suggestions match");
    }
    closeAutocompletePopup();
    return;
  }
  renderAutocompletePopup(cm, suggestions, prefixInfo);
}

export const EditorComponent = {
  initEditor() {
    const editorTextarea = el("sql-editor");
    if (!editorTextarea) return;

    const extraKeys = {
      "Cmd-Enter": () => state.emit("editorRun"),
      "Ctrl-Enter": () => state.emit("editorRun"),
      "Cmd-'": () => state.emit("editorPreview"),
      "Ctrl-'": () => state.emit("editorPreview"),
      "Cmd-B": () => {
        if (state.settings.shortcutPreview === "cmd-b") state.emit("editorPreview");
      },
      "Ctrl-B": () => {
        if (state.settings.shortcutPreview === "cmd-b") state.emit("editorPreview");
      },
      "Shift-Enter": () => {
        if (state.settings.shortcutRun === "shift-enter") state.emit("editorRun");
      },
      "Cmd-S": () => {
        if (state.settings.shortcutRun === "cmd-s") state.emit("editorRun");
      },
      "Ctrl-S": () => {
        if (state.settings.shortcutRun === "cmd-s") state.emit("editorRun");
      },
      "Cmd-/": (cm) => EditorComponent.toggleSqlComment(cm),
      "Ctrl-/": (cm) => EditorComponent.toggleSqlComment(cm),
      "Ctrl-Space": (cm) => triggerAutocomplete(cm, true),
      "Tab": (cm) => {
        if (cm.somethingSelected()) {
          cm.indentSelection("add");
        } else {
          cm.replaceSelection("  ", "end");
        }
      },
      "Shift-Tab": (cm) => {
        cm.indentSelection("subtract");
      },
      "Enter": (cm) => {
        const cursor = cm.getCursor();
        const lineText = cm.getLine(cursor.line);
        const leadingSpace = (lineText.match(/^[\t ]*/) || [""])[0];
        const textBefore = lineText.slice(0, cursor.ch).trim();
        const textAfter = lineText.slice(cursor.ch).trim();

        if ((textBefore.endsWith("(") && textAfter.startsWith(")")) ||
            (textBefore.endsWith("{") && textAfter.startsWith("}"))) {
          cm.replaceSelection("\n" + leadingSpace + "  \n" + leadingSpace, "start");
          cm.setCursor({ line: cursor.line + 1, ch: leadingSpace.length + 2 });
          return;
        }

        let extra = "";
        if (textBefore.endsWith("(") || textBefore.endsWith("{") || /\b(case|begin)$/i.test(textBefore)) {
          extra = "  ";
        }
        cm.replaceSelection("\n" + leadingSpace + extra, "end");
      }
    };

    if (window.CodeMirror) {
      state.editor = CodeMirror.fromTextArea(editorTextarea, {
        mode: "text/x-mysql",
        theme: "dracula",
        lineNumbers: true,
        lineWrapping: true,
        indentWithTabs: false,
        smartIndent: false,
        electricChars: false,
        indentUnit: 2,
        tabSize: 2,
        extraKeys: extraKeys
      });
      EditorComponent.applySettingsToEditor();
      NavbarComponent.applyCodeTheme(state.codeTheme, state.plainMode);

      state.editor.on("cursorActivity", () => {
        const pos = state.editor.getCursor();
        const posEl = el("editor-cursor-pos");
        if (posEl) posEl.textContent = `Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
        if (isAutocompleteOpen()) {
          const prefixInfo = getAutocompletePrefix(state.editor);
          if (!prefixInfo.prefix && !prefixInfo.qualifier) {
            closeAutocompletePopup();
          }
        }
      });

      state.editor.on("inputRead", (cm, change) => {
        if (state.settings.autocompleteMode === "off") return;
        if (!change.text || change.text.length === 0) return;
        const ch = change.text[0];
        if (!/[a-zA-Z0-9_.]/.test(ch)) {
          closeAutocompletePopup();
          return;
        }
        handleAutocompleteInput(cm);
      });

      state.editor.on("keydown", (cm, e) => {
        if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.code === "Slash" || e.keyCode === 191)) {
          e.preventDefault();
          e.stopPropagation();
          EditorComponent.toggleSqlComment(cm);
          return;
        }

        if (isAutocompleteOpen()) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            moveAutocompleteSelection(1);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            moveAutocompleteSelection(-1);
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            applySelectedAutocomplete(cm);
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeAutocompletePopup();
            return;
          }
        }
      });

      state.editor.on("blur", () => {
        setTimeout(() => closeAutocompletePopup(), 200);
      });

      state.editor.on("scroll", () => {
        if (isAutocompleteOpen()) {
          updateAutocompletePosition(state.editor);
        }
      });

      let saveTimeout = null;
      state.editor.on("change", () => {
        const saveEl = el("editor-status-saved");
        if (saveEl) {
          saveEl.textContent = "Saving...";
          saveEl.classList.remove("saved");
        }
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          if (state.currentQuestion) {
            localStorage.setItem(`sqlmaster_draft_${state.currentQuestion.slug}`, state.editor.getValue());
          }
          if (saveEl) {
            saveEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> <span>Saved</span>`;
            saveEl.classList.add("saved");
          }
        }, 300);
      });
    } else {
      editorTextarea.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.code === "Slash")) {
          e.preventDefault();
          EditorComponent.toggleSqlCommentTextarea(editorTextarea);
        } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          state.emit("editorRun");
        } else if ((e.metaKey || e.ctrlKey) && (e.key === "'" || e.key === "\"")) {
          e.preventDefault();
          state.emit("editorPreview");
        }
      });
    }
  },

  getQueryCode() {
    return state.editor ? state.editor.getValue() : (el("sql-editor")?.value || "");
  },

  setQueryCode(code) {
    if (state.editor) {
      state.editor.setValue(code);
    } else if (el("sql-editor")) {
      el("sql-editor").value = code;
    }
  },

  formatEditorSQL() {
    const raw = EditorComponent.getQueryCode();
    const formatted = raw.replace(/\b(select|from|where|group by|order by|having|join|left join|right join|inner join|cross join|outer join|on|as|and|or|in|not in|with|limit|union all|union|count|sum|avg|max|min|round|distinct|over|partition by|case|when|then|else|end|coalesce|cast|extract|date_format|null|is null|is not null|between|exists|not exists)\b/gi, (m) => m.toUpperCase());
    EditorComponent.setQueryCode(formatted);
    showToast("Formatted SQL keywords");
  },

  applySettingsToEditor() {
    const cmEl = document.querySelector(".CodeMirror");
    if (cmEl) {
      cmEl.style.fontSize = state.settings.fontSize;
    }
  },

  toggleSqlComment(cm) {
    if (!cm) {
      const tx = el("sql-editor");
      if (tx) EditorComponent.toggleSqlCommentTextarea(tx);
      return;
    }

    const from = cm.getCursor("from");
    const to = cm.getCursor("to");
    const startLine = from.line;
    let endLine = to.line;
    const hasSelection = cm.somethingSelected();

    if (hasSelection && endLine > startLine && to.ch === 0) {
      endLine--;
    }

    let allCommented = true;
    let hasNonBlank = false;
    for (let i = startLine; i <= endLine; i++) {
      const lineText = cm.getLine(i);
      const trimmed = lineText.trim();
      if (trimmed.length > 0) {
        hasNonBlank = true;
        if (!trimmed.startsWith("--")) {
          allCommented = false;
        }
      }
    }

    const shouldComment = !hasNonBlank || !allCommented;
    const originalCursor = cm.getCursor();
    let cursorDelta = 0;

    cm.operation(() => {
      if (!shouldComment) {
        for (let i = startLine; i <= endLine; i++) {
          const lineText = cm.getLine(i);
          const match = lineText.match(/^(\s*)--\s?(.*)$/);
          if (match) {
            const removedLen = lineText.length - (match[1] + match[2]).length;
            cm.replaceRange(match[1] + match[2], { line: i, ch: 0 }, { line: i, ch: lineText.length });
            if (!hasSelection && i === originalCursor.line) {
              cursorDelta = -removedLen;
            }
          }
        }
      } else {
        for (let i = startLine; i <= endLine; i++) {
          const lineText = cm.getLine(i);
          if (hasSelection && lineText.trim().length === 0) continue;
          const match = lineText.match(/^(\s*)(.*)$/);
          const indent = match ? match[1] : "";
          const rest = match ? match[2] : lineText;
          cm.replaceRange(`${indent}-- ${rest}`, { line: i, ch: 0 }, { line: i, ch: lineText.length });
          if (!hasSelection && i === originalCursor.line) {
            cursorDelta = 3;
          }
        }
      }
    });

    if (hasSelection) {
      cm.setSelection(
        { line: startLine, ch: 0 },
        { line: endLine, ch: cm.getLine(endLine).length }
      );
    } else {
      cm.setCursor({
        line: originalCursor.line,
        ch: Math.max(0, originalCursor.ch + cursorDelta)
      });
    }

    const count = endLine - startLine + 1;
    const toastMsg = shouldComment
      ? (count > 1 ? `Commented ${count} lines (--)` : "Commented line (--)")
      : (count > 1 ? `Uncommented ${count} lines (--)` : "Uncommented line (--)");
    showToast(toastMsg);
  },

  toggleSqlCommentTextarea(tx) {
    if (!tx) return;
    const start = tx.selectionStart;
    const end = tx.selectionEnd;
    const val = tx.value;

    const lineStart = val.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = val.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = val.length;

    const textChunk = val.substring(lineStart, lineEnd);
    const lines = textChunk.split("\n");

    let allCommented = true;
    let hasNonBlank = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        hasNonBlank = true;
        if (!trimmed.startsWith("--")) {
          allCommented = false;
        }
      }
    }

    const shouldComment = !hasNonBlank || !allCommented;
    const newLines = lines.map(line => {
      if (!shouldComment) {
        return line.replace(/^(\s*)--\s?/, "$1");
      } else {
        if (lines.length > 1 && line.trim().length === 0) return line;
        const m = line.match(/^(\s*)(.*)$/);
        return m ? `${m[1]}-- ${m[2]}` : `-- ${line}`;
      }
    });

    const replaced = newLines.join("\n");
    tx.value = val.substring(0, lineStart) + replaced + val.substring(lineEnd);
    tx.selectionStart = lineStart;
    tx.selectionEnd = lineStart + replaced.length;

    const count = lines.length;
    showToast(shouldComment ? (count > 1 ? `Commented ${count} lines (--)` : "Commented line (--)") : (count > 1 ? `Uncommented ${count} lines (--)` : "Uncommented line (--)"));
  }
};
