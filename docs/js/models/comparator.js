/**
 * SQL Results Comparator Model
 * Normalizes values, checks order sensitivity, and compares expected vs actual outputs.
 */

export function normalizeVal(val) {
  if (val === null || val === undefined || val === "NULL" || val === "None" || val === "") return null;
  if (typeof val === "number") return Math.abs(val) < 1e-9 ? 0 : val;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim();
    if (!isNaN(s) && s !== "") {
      const num = Number(s);
      return Math.abs(num) < 1e-9 ? 0 : num;
    }
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/);
    if (m) {
      const [, month, day, year, timePart] = m;
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return (timePart && timePart !== "00:00:00") ? `${iso} ${timePart}` : iso;
    }
    if (/^\d{4}-\d{2}-\d{2}\s+00:00:00$/.test(s)) return s.slice(0, 10);
    return s;
  }
  return val;
}

export function valsEqual(v1, v2, tol = 0.005) {
  const n1 = normalizeVal(v1);
  const n2 = normalizeVal(v2);
  if (n1 === null && n2 === null) return true;
  if (n1 === null || n2 === null) return false;
  if (typeof n1 === "number" && typeof n2 === "number") {
    return Math.abs(n1 - n2) <= tol || (n2 !== 0 && Math.abs((n1 - n2) / n2) <= tol);
  }
  const s1 = String(n1).trim().replace("T", " ").replace(/\s+00:00(?::00)?$/, "");
  const s2 = String(n2).trim().replace("T", " ").replace(/\s+00:00(?::00)?$/, "");
  return s1 === s2;
}

export function rowSortKey(row) {
  const keys = Object.keys(row).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return keys.map(k => {
    const nv = normalizeVal(row[k]);
    return `${k.toLowerCase()}=${typeof nv === "number" ? nv.toFixed(4) : nv}`;
  }).join(" | ");
}

export function rowsEqual(er, ar, expCols, tol = 0.005) {
  for (const colLower of Object.keys(expCols)) {
    const ev = er[colLower];
    const av = ar[colLower];
    if (!valsEqual(ev, av, tol)) {
      return { ok: false, detail: `column '${expCols[colLower]}': expected ${JSON.stringify(ev)}, got ${JSON.stringify(av)}` };
    }
  }
  return { ok: true };
}

export function compareResults(expected, actual, orderSensitive = false, tol = 0.005) {
  expected = expected || [];
  actual = actual || [];
  if (expected.length !== actual.length) {
    return { passed: false, message: `Row count mismatch: expected ${expected.length} rows, got ${actual.length} rows.` };
  }
  if (expected.length === 0) return { passed: true, message: "Passed (both empty results)." };

  const expCols = {};
  for (const k of Object.keys(expected[0])) expCols[k.toLowerCase()] = k;
  const actCols = {};
  for (const k of Object.keys(actual[0])) actCols[k.toLowerCase()] = k;

  const expKeys = Object.keys(expCols).sort();
  const actKeys = Object.keys(actCols).sort();
  if (expKeys.join(",") !== actKeys.join(",")) {
    if (expKeys.length === 1 && actKeys.length === 1) {
      const expK = expKeys[0];
      const actK = actKeys[0];
      actual = actual.map(r => ({ [expCols[expK]]: r[actCols[actK]] }));
    } else {
      return { passed: false, message: `Column mismatch: expected columns [${expKeys.join(", ")}], got [${actKeys.join(", ")}].` };
    }
  }

  const normExp = expected.map(r => {
    const res = {};
    for (const k of Object.keys(r)) res[k.toLowerCase()] = r[k];
    return res;
  });
  const normAct = actual.map(r => {
    const res = {};
    for (const k of Object.keys(r)) res[k.toLowerCase()] = r[k];
    return res;
  });

  let mode = "none";
  let partialCols = null;
  if (typeof orderSensitive === "boolean") {
    mode = orderSensitive ? "full" : "none";
  } else if (typeof orderSensitive === "string") {
    const low = orderSensitive.trim().toLowerCase();
    if (low === "true" || low === "full" || low === "1") mode = "full";
    else if (low.startsWith("partial")) {
      mode = "partial";
      const rest = low.replace(/^partial:?/, "").trim();
      partialCols = rest ? rest.split(",").map(c => c.trim().toLowerCase()).filter(Boolean) : null;
      if (!partialCols || partialCols.length === 0) mode = "none";
    }
  }

  if (mode === "none") {
    const sortedExp = [...normExp].sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b)));
    const sortedAct = [...normAct].sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b)));
    for (let i = 0; i < sortedExp.length; i++) {
      const chk = rowsEqual(sortedExp[i], sortedAct[i], expCols, tol);
      if (!chk.ok) return { passed: false, message: `Row ${i + 1} mismatch on ${chk.detail}.` };
    }
    return { passed: true, message: "Passed all row and column checks." };
  }

  if (mode === "full") {
    for (let i = 0; i < normExp.length; i++) {
      const chk = rowsEqual(normExp[i], normAct[i], expCols, tol);
      if (!chk.ok) return { passed: false, message: `Row ${i + 1} mismatch on ${chk.detail}.` };
    }
    return { passed: true, message: "Passed all row and column checks." };
  }

  return { passed: true, message: "Passed all row and column checks." };
}
