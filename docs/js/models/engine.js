/**
 * SQL Execution Engine Model
 * Provides dual-engine execution: In-Browser WebAssembly DuckDB + REST Runner fallback.
 */

import { state } from "./state.js";
import { compareResults } from "./comparator.js";
import { showToast } from "../utils.js";

let duckDBModule = null;
let duckDBInstance = null;
let duckDBInitPromise = null;

export const Engine = {
  async getDuckDB() {
    if (duckDBInstance) return duckDBInstance;
    if (duckDBInitPromise) return duckDBInitPromise;

    duckDBInitPromise = (async () => {
      try {
        showToast("Initializing in-browser SQL engine (WebAssembly)...");
        if (!duckDBModule) {
          duckDBModule = await import("https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm");
        }
        const JSDELIVR_BUNDLES = duckDBModule.getJsDelivrBundles();
        const bundle = await duckDBModule.selectBundle(JSDELIVR_BUNDLES);
        const worker_url = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" })
        );
        const worker = new Worker(worker_url);
        const logger = new duckDBModule.ConsoleLogger();
        const db = new duckDBModule.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(worker_url);

        // Register standard MySQL 8.0 macros in DuckDB
        const conn = await db.connect();
        try {
          await conn.query(`CREATE OR REPLACE MACRO datediff(d1, d2) AS date_diff('day', CAST(d2 AS TIMESTAMP), CAST(d1 AS TIMESTAMP));`);
          await conn.query(`CREATE OR REPLACE MACRO year(d) AS date_part('year', CAST(d AS TIMESTAMP));`);
          await conn.query(`CREATE OR REPLACE MACRO month(d) AS date_part('month', CAST(d AS TIMESTAMP));`);
          await conn.query(`CREATE OR REPLACE MACRO day(d) AS date_part('day', CAST(d AS TIMESTAMP));`);
          await conn.query(`CREATE OR REPLACE MACRO curdate() AS current_date;`);
          await conn.query(`CREATE OR REPLACE MACRO date_format(d, fmt) AS strftime(CAST(d AS TIMESTAMP), fmt);`);
        } catch (e) {
          console.warn("Could not register default MySQL macros:", e);
        } finally {
          await conn.close();
        }

        duckDBInstance = db;
        showToast("In-browser WebAssembly SQL engine ready!");
        return db;
      } catch (err) {
        duckDBInitPromise = null;
        console.error("DuckDB initialization failed:", err);
        throw new Error(`In-browser WebAssembly engine failed to load: ${err.message}. If running locally, you can use 'python3 cli.py serve'.`);
      }
    })();

    return duckDBInitPromise;
  },

  mapDuckDBType(rawType) {
    const ctype = (rawType || "").toUpperCase();
    if (ctype.includes("VARCHAR") || ctype.includes("CHAR") || ctype.includes("TEXT")) return "VARCHAR";
    if (ctype.includes("INT")) return ctype.includes("BIGINT") ? "BIGINT" : "INTEGER";
    if (ctype.includes("DECIMAL") || ctype.includes("NUMERIC") || ctype.includes("FLOAT") || ctype.includes("DOUBLE")) return "DOUBLE";
    if (ctype.includes("DATETIME") || ctype.includes("TIMESTAMP")) return "TIMESTAMP";
    if (ctype.includes("DATE")) return "DATE";
    if (ctype.includes("TIME")) return "TIME";
    if (ctype.includes("BOOL")) return "BOOLEAN";
    return "VARCHAR";
  },

  formatSQLValue(val, dataType) {
    if (val === null || val === undefined || val === "") return "NULL";
    const sVal = String(val).trim();
    const uVal = sVal.toUpperCase();
    if (["NULL", "NONE", "-", "—", "N/A", "NA", "?"].includes(uVal)) return "NULL";

    const tUpper = (dataType || "").toUpperCase();
    if (tUpper.includes("INT")) {
      const clean = sVal.replace(/[, $]/g, "");
      const num = parseInt(clean, 10);
      return isNaN(num) ? "NULL" : String(num);
    }
    if (tUpper.includes("DECIMAL") || tUpper.includes("NUMERIC") || tUpper.includes("FLOAT") || tUpper.includes("DOUBLE")) {
      const clean = sVal.replace(/[, $]/g, "");
      const num = parseFloat(clean);
      return isNaN(num) ? "NULL" : String(num);
    }
    if (tUpper.includes("DATE") || tUpper.includes("TIME")) {
      let s = sVal;
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/);
      if (m) {
        const [, month, day, year, timePart] = m;
        let iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (timePart) {
          iso += ` ${timePart}`;
        } else if (tUpper.includes("DATETIME") || tUpper.includes("TIMESTAMP")) {
          iso += " 00:00:00";
        }
        s = iso;
      }
      const escaped = s.replace(/'/g, "''");
      return `'${escaped}'`;
    }
    if (tUpper.includes("BOOL")) {
      if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
      if (["true", "t", "1", "yes"].includes(sVal.toLowerCase())) return "TRUE";
      if (["false", "f", "0", "no"].includes(sVal.toLowerCase())) return "FALSE";
      return "NULL";
    }

    const escaped = sVal.replace(/'/g, "''");
    return `'${escaped}'`;
  },

  async runClientQuery(tables, inputData, sql) {
    const db = await Engine.getDuckDB();
    const conn = await db.connect();
    try {
      for (const tbl of (tables || [])) {
        const tblName = tbl.table_name;
        const cols = (tbl.columns || []).map(c => ({ ...c }));
        const existingCols = new Set(cols.map(c => c.column_name.toLowerCase()));
        const rows = (inputData && inputData[tblName]) || [];

        for (const r of rows) {
          for (const k of Object.keys(r)) {
            if (!existingCols.has(k.toLowerCase())) {
              const rawVal = r[k];
              const inferred = (typeof rawVal === "number" && Number.isInteger(rawVal)) ? "INT" : "VARCHAR(255)";
              cols.push({ column_name: k, data_type: inferred });
              existingCols.add(k.toLowerCase());
            }
          }
        }

        await conn.query(`DROP TABLE IF EXISTS "${tblName}";`);
        const colDefs = cols.map(c => `"${c.column_name}" ${Engine.mapDuckDBType(c.data_type)}`).join(", ");
        await conn.query(`CREATE TABLE "${tblName}" (${colDefs || '"_dummy" VARCHAR'});`);

        if (rows.length > 0) {
          const valueTuples = rows.map(r => {
            const vals = cols.map(c => {
              let v = null;
              for (const k of Object.keys(r)) {
                if (k.toLowerCase() === c.column_name.toLowerCase()) {
                  v = r[k];
                  break;
                }
              }
              return Engine.formatSQLValue(v, c.data_type);
            });
            return `(${vals.join(", ")})`;
          });

          for (let b = 0; b < valueTuples.length; b += 50) {
            const chunk = valueTuples.slice(b, b + 50);
            await conn.query(`INSERT INTO "${tblName}" VALUES ${chunk.join(", ")};`);
          }
        }
      }

      await conn.query(`CREATE OR REPLACE VIEW "places" AS SELECT * FROM "place_info";`).catch(() => {});
      await conn.query(`CREATE OR REPLACE VIEW "ugc" AS SELECT * FROM "maps_ugc_review";`).catch(() => {});

      const cleanSql = (sql || "").trim().replace(/;+$/, "");
      const t0 = performance.now();
      const arrowResult = await conn.query(cleanSql);
      const elapsedMs = Math.round(performance.now() - t0);

      const scaleMap = {};
      for (const f of (arrowResult.schema && arrowResult.schema.fields) || []) {
        if (f.type && typeof f.type.scale === "number" && f.type.scale > 0) {
          scaleMap[f.name] = f.type.scale;
        }
      }

      const rawRows = arrowResult.toArray().map(row => row.toJSON());
      const rows = rawRows.map(r => {
        const obj = {};
        for (const k of Object.keys(r)) {
          let v = r[k];
          if (v !== null && v !== undefined) {
            if (typeof v === "object" && typeof v.toJSON === "function") {
              v = v.toJSON();
            }
            if (typeof v === "bigint") {
              v = Number(v);
            } else {
              const strVal = String(v).replace(/"/g, "").trim();
              if (!isNaN(strVal) && strVal !== "") {
                const num = Number(strVal);
                if (!isNaN(num)) {
                  v = num;
                }
              }
            }
            if (scaleMap[k] && typeof v === "number") {
              v = v / Math.pow(10, scaleMap[k]);
            }
          }
          obj[k] = v;
        }
        return obj;
      });
      return { success: true, rows, elapsed_ms: elapsedMs };
    } catch (err) {
      return { success: false, error: err.message, rows: [] };
    } finally {
      await conn.close();
    }
  },

  async executeInBrowserSuite(slug, sql, testCases) {
    const q = state.currentQuestion || (state.allQuestionsDetail && state.allQuestionsDetail[slug]);
    if (!q) throw new Error(`Question definition not found for '${slug}'`);

    const tables = q.tables || [];
    const refSql = (q.reference_sql || "").trim();
    const orderSensitive = q.order_sensitive || false;
    const cases = testCases || q.test_cases || [];

    const results = [];
    let allPassed = true;
    const tStart = performance.now();

    for (let idx = 0; idx < cases.length; idx++) {
      const tc = cases[idx];
      const tcId = tc.test_case_id || `case_${idx + 1}`;
      const desc = tc.description || `Case ${idx + 1}`;
      const inputData = tc.input_data || {};
      let expected = tc.expected_output;

      if ((tc.category === "custom" || tc.is_edited || expected === undefined || expected === null) && refSql) {
        const refRes = await Engine.runClientQuery(tables, inputData, refSql);
        if (refRes.success) {
          expected = refRes.rows;
        }
      }

      const execRes = await Engine.runClientQuery(tables, inputData, sql);
      if (!execRes.success) {
        allPassed = false;
        results.push({
          test_case_id: tcId,
          description: desc,
          input_data: inputData,
          passed: false,
          message: "Execution error",
          error: execRes.error,
          expected_output: expected || [],
          actual_output: [],
          elapsed_ms: execRes.elapsed_ms || 0
        });
        continue;
      }

      const cmp = compareResults(expected || [], execRes.rows, orderSensitive);
      if (!cmp.passed) allPassed = false;

      results.push({
        test_case_id: tcId,
        description: desc,
        input_data: inputData,
        passed: cmp.passed,
        message: cmp.message,
        error: null,
        expected_output: expected || [],
        actual_output: execRes.rows,
        elapsed_ms: execRes.elapsed_ms || 0
      });
    }

    const totalMs = Math.round(performance.now() - tStart);
    const passedCount = results.filter(r => r.passed).length;

    return {
      slug,
      all_passed: allPassed,
      passed_count: passedCount,
      total_count: results.length,
      summary: `${passedCount}/${results.length} test cases passed`,
      total_ms: totalMs,
      test_cases: results
    };
  },

  async executeRunRequest(slug, sql, testCases) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sql, test_cases: testCases }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      // Backend not running / static mode
    }

    return await Engine.executeInBrowserSuite(slug, sql, testCases);
  },

  async deriveExpectedOutput(slug, inputData) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const res = await fetch("/api/testcase/derive-expected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, input_data: inputData }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}

    const q = state.currentQuestion || (state.allQuestionsDetail && state.allQuestionsDetail[slug]);
    if (!q || !q.reference_sql) throw new Error("Reference solution not available to derive expected output");
    const execRes = await Engine.runClientQuery(q.tables || [], inputData, q.reference_sql);
    if (!execRes.success) throw new Error(execRes.error);
    return {
      success: true,
      expected_output: execRes.rows,
      elapsed_ms: execRes.elapsed_ms
    };
  }
};
