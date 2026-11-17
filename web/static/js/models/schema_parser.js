/**
 * schema_parser.js — Schema-Aware Column Parsers, Validators & Formatters for SQLMaster
 * 
 * Provides robust client-side validation and canonical normalization for all MySQL 8.0 data types:
 *   - INT / BIGINT / TINYINT / SMALLINT
 *   - DECIMAL / NUMERIC / FLOAT / DOUBLE
 *   - DATE (supports multiple formats: YYYY-MM-DD, MM/DD/YYYY, YYYY/MM/DD, DD-Mon-YYYY, etc.)
 *   - DATETIME / TIMESTAMP (YYYY-MM-DD HH:MM:SS, ISO 8601, etc.)
 *   - BOOLEAN (true/false, 1/0, yes/no)
 *   - VARCHAR / TEXT / CHAR (length limits, quote stripping)
 *   - NULL handling (empty string, "null", "NULL", "none", etc.)
 */

const MONTH_NAMES = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function daysInMonth(year, month) {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] || 0;
}

export const SchemaParser = {
  /**
   * Normalizes a SQL data type string (e.g. "DECIMAL(10,2)", "VARCHAR(255)")
   * into a base type and options object.
   */
  normalizeType(rawType = "") {
    if (!rawType || typeof rawType !== "string") {
      return { baseType: "VARCHAR", length: null, precision: null, scale: null };
    }
    const clean = rawType.trim().toUpperCase();
    const match = clean.match(/^([A-Z]+)(?:\s*\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\))?/);
    if (!match) {
      return { baseType: clean, length: null, precision: null, scale: null };
    }

    const base = match[1];
    const p1 = match[2] ? parseInt(match[2], 10) : null;
    const p2 = match[3] ? parseInt(match[3], 10) : null;

    if (["INT", "INTEGER", "BIGINT", "TINYINT", "SMALLINT", "MEDIUMINT"].includes(base)) {
      return { baseType: "INT", width: p1 };
    }
    if (["DECIMAL", "NUMERIC"].includes(base)) {
      return { baseType: "DECIMAL", precision: p1 || 10, scale: p2 !== null ? p2 : 0 };
    }
    if (["FLOAT", "DOUBLE", "REAL"].includes(base)) {
      return { baseType: "DOUBLE", precision: p1, scale: p2 };
    }
    if (["DATE"].includes(base)) {
      return { baseType: "DATE" };
    }
    if (["DATETIME", "TIMESTAMP"].includes(base)) {
      return { baseType: "DATETIME" };
    }
    if (["BOOLEAN", "BOOL"].includes(base)) {
      return { baseType: "BOOLEAN" };
    }
    if (["VARCHAR", "CHAR", "TEXT", "TINYTEXT", "MEDIUMTEXT", "LONGTEXT"].includes(base)) {
      return { baseType: "VARCHAR", length: p1 };
    }

    return { baseType: base, length: p1, precision: p1, scale: p2 };
  },

  /**
   * Checks if a raw string represents NULL.
   */
  isNullValue(raw) {
    if (raw === null || raw === undefined) return true;
    const str = String(raw).trim();
    return str === "" || str.toUpperCase() === "NULL" || str.toLowerCase() === "none" || str.toLowerCase() === "nil";
  },

  /**
   * Parses integer data types (INT, BIGINT, TINYINT, etc.).
   */
  parseInteger(raw) {
    if (this.isNullValue(raw)) {
      return { valid: true, value: null, formatted: "NULL" };
    }

    // Number passed directly
    if (typeof raw === "number") {
      if (Number.isInteger(raw)) {
        return { valid: true, value: raw, formatted: String(raw) };
      }
      return { valid: false, error: `Expected integer, received decimal number: ${raw}` };
    }

    let str = String(raw).trim();
    // Allow formatted numbers with commas, e.g. "1,000,000"
    if (/^-?\d{1,3}(?:,\d{3})+$/.test(str)) {
      str = str.replace(/,/g, "");
    }

    if (!/^-?\d+$/.test(str)) {
      if (/^-?\d*\.\d+$/.test(str)) {
        return { valid: false, error: `Expected integer, received decimal '${raw}'. Use a whole number.` };
      }
      return { valid: false, error: `Invalid integer '${raw}'. Expected digits only.` };
    }

    const num = parseInt(str, 10);
    if (!Number.isSafeInteger(num)) {
      return { valid: false, error: `Integer '${raw}' exceeds safe integer range.` };
    }

    return { valid: true, value: num, formatted: String(num) };
  },

  /**
   * Parses decimal and floating-point data types (DECIMAL, FLOAT, DOUBLE).
   */
  parseDecimal(raw, options = {}) {
    if (this.isNullValue(raw)) {
      return { valid: true, value: null, formatted: "NULL" };
    }

    if (typeof raw === "number") {
      if (isNaN(raw)) return { valid: false, error: "Invalid numeric value (NaN)" };
      const formatted = (options.scale !== null && options.scale !== undefined) 
        ? raw.toFixed(options.scale) 
        : String(raw);
      return { valid: true, value: raw, formatted };
    }

    let str = String(raw).trim();
    // Remove thousand commas e.g. "1,234.56"
    if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(str)) {
      str = str.replace(/,/g, "");
    }

    if (!/^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(str)) {
      return { valid: false, error: `Invalid decimal number '${raw}'.` };
    }

    const num = parseFloat(str);
    if (isNaN(num)) {
      return { valid: false, error: `Invalid decimal number '${raw}'.` };
    }

    let formatted = str;
    if (options.scale !== null && options.scale !== undefined && options.scale > 0) {
      if (!str.includes(".")) {
        formatted = num.toFixed(options.scale);
      }
    }

    return { valid: true, value: num, formatted };
  },

  /**
   * Parses DATE values across multiple standard formats:
   *   - YYYY-MM-DD or YYYY/MM/DD (e.g. 2023-01-15)
   *   - MM/DD/YYYY or M/D/YYYY (e.g. 01/15/2023)
   *   - DD/MM/YYYY (e.g. 25/12/2023)
   *   - DD-Mon-YYYY or Mon DD, YYYY (e.g. 15-Jan-2023, Jan 15, 2023)
   *   - YYYYMMDD (e.g. 20230115)
   *   - Timestamps (e.g. 2023-01-15T12:00:00 -> extracts 2023-01-15)
   * 
   * Normalizes to canonical MySQL format: YYYY-MM-DD
   */
  parseDate(raw) {
    if (this.isNullValue(raw)) {
      return { valid: true, value: null, formatted: "NULL" };
    }

    const str = String(raw).trim();
    let year = null, month = null, day = null;

    // 1. YYYY-MM-DD or YYYY/MM/DD (with optional time)
    let m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
    if (m) {
      year = parseInt(m[1], 10);
      month = parseInt(m[2], 10);
      day = parseInt(m[3], 10);
    } else {
      // 2. MM/DD/YYYY or DD/MM/YYYY (with optional time)
      m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T].*)?$/);
      if (m) {
        const p1 = parseInt(m[1], 10);
        const p2 = parseInt(m[2], 10);
        year = parseInt(m[3], 10);
        if (p1 > 12) {
          // Unambiguously Day/Month/Year
          day = p1;
          month = p2;
        } else {
          // Standard US Month/Day/Year
          month = p1;
          day = p2;
        }
      } else {
        // 3. DD-Mon-YYYY or Mon DD, YYYY
        m = str.match(/^(\d{1,2})[- ]+([A-Za-z]+)[- ,]+(\d{4})$/);
        if (m) {
          day = parseInt(m[1], 10);
          const mKey = m[2].toLowerCase();
          month = MONTH_NAMES[mKey];
          year = parseInt(m[3], 10);
        } else {
          m = str.match(/^([A-Za-z]+)[- ]+(\d{1,2})[- ,]+(\d{4})$/);
          if (m) {
            const mKey = m[1].toLowerCase();
            month = MONTH_NAMES[mKey];
            day = parseInt(m[2], 10);
            year = parseInt(m[3], 10);
          } else if (/^\d{8}$/.test(str)) {
            // YYYYMMDD
            year = parseInt(str.slice(0, 4), 10);
            month = parseInt(str.slice(4, 6), 10);
            day = parseInt(str.slice(6, 8), 10);
          }
        }
      }
    }

    if (!year || !month || !day) {
      return { 
        valid: false, 
        error: `Invalid DATE format: '${raw}'. Expected YYYY-MM-DD or MM/DD/YYYY.` 
      };
    }

    if (month < 1 || month > 12) {
      return { valid: false, error: `Invalid date month '${month}'. Month must be between 1 and 12.` };
    }

    const maxDays = daysInMonth(year, month);
    if (day < 1 || day > maxDays) {
      if (month === 2 && day === 29 && !isLeapYear(year)) {
        return { valid: false, error: `Invalid calendar date: Year ${year} is not a leap year (February has 28 days).` };
      }
      return { valid: false, error: `Invalid calendar date: Month ${month} in year ${year} has ${maxDays} days.` };
    }

    const yStr = String(year).padStart(4, "0");
    const mStr = String(month).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const canonical = `${yStr}-${mStr}-${dStr}`;
    return { valid: true, value: canonical, formatted: canonical };
  },

  /**
   * Parses DATETIME / TIMESTAMP values:
   *   - YYYY-MM-DD HH:MM:SS
   *   - ISO 8601: YYYY-MM-DDTHH:MM:SS
   *   - MM/DD/YYYY HH:MM:SS
   *   - YYYY-MM-DD (defaults time to 00:00:00)
   * 
   * Normalizes to canonical MySQL format: YYYY-MM-DD HH:MM:SS
   */
  parseDateTime(raw) {
    if (this.isNullValue(raw)) {
      return { valid: true, value: null, formatted: "NULL" };
    }

    const str = String(raw).trim();
    let year = null, month = null, day = null;
    let hour = 0, min = 0, sec = 0;

    // 1. YYYY-MM-DD or YYYY/MM/DD with optional time
    let m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (m) {
      year = parseInt(m[1], 10);
      month = parseInt(m[2], 10);
      day = parseInt(m[3], 10);
      if (m[4] !== undefined) hour = parseInt(m[4], 10);
      if (m[5] !== undefined) min = parseInt(m[5], 10);
      if (m[6] !== undefined) sec = parseInt(m[6], 10);
    } else {
      // 2. MM/DD/YYYY or DD/MM/YYYY with optional time
      m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
      if (m) {
        const p1 = parseInt(m[1], 10);
        const p2 = parseInt(m[2], 10);
        year = parseInt(m[3], 10);
        if (p1 > 12) {
          day = p1;
          month = p2;
        } else {
          month = p1;
          day = p2;
        }
        if (m[4] !== undefined) hour = parseInt(m[4], 10);
        if (m[5] !== undefined) min = parseInt(m[5], 10);
        if (m[6] !== undefined) sec = parseInt(m[6], 10);
      }
    }

    if (!year || !month || !day) {
      return { 
        valid: false, 
        error: `Invalid DATETIME format: '${raw}'. Expected 'YYYY-MM-DD HH:MM:SS'.` 
      };
    }

    if (month < 1 || month > 12) {
      return { valid: false, error: `Invalid month '${month}'. Month must be between 1 and 12.` };
    }

    const maxDays = daysInMonth(year, month);
    if (day < 1 || day > maxDays) {
      return { valid: false, error: `Invalid day '${day}'. Month ${month} in year ${year} has ${maxDays} days.` };
    }

    if (hour < 0 || hour > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) {
      return { valid: false, error: `Invalid time components in '${raw}'. Expected 24-hr time (HH: 0-23, MM: 0-59, SS: 0-59).` };
    }

    const yStr = String(year).padStart(4, "0");
    const mStr = String(month).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const hStr = String(hour).padStart(2, "0");
    const miStr = String(min).padStart(2, "0");
    const sStr = String(sec).padStart(2, "0");
    const canonical = `${yStr}-${mStr}-${dStr} ${hStr}:${miStr}:${sStr}`;
    return { valid: true, value: canonical, formatted: canonical };
  },

  /**
   * Parses BOOLEAN / TINYINT(1) values.
   */
  parseBoolean(raw) {
    if (this.isNullValue(raw)) {
      return { valid: true, value: null, formatted: "NULL" };
    }

    if (typeof raw === "boolean") {
      return { valid: true, value: raw ? 1 : 0, formatted: raw ? "true" : "false" };
    }
    if (typeof raw === "number") {
      if (raw === 1 || raw === 0) {
        return { valid: true, value: raw, formatted: raw === 1 ? "true" : "false" };
      }
    }

    const str = String(raw).trim().toLowerCase();
    if (["true", "t", "1", "yes", "y"].includes(str)) {
      return { valid: true, value: 1, formatted: "true" };
    }
    if (["false", "f", "0", "no", "n"].includes(str)) {
      return { valid: true, value: 0, formatted: "false" };
    }

    return { valid: false, error: `Invalid boolean '${raw}'. Expected true/false or 1/0.` };
  },

  /**
   * Parses VARCHAR, CHAR, and TEXT values.
   */
  parseVarchar(raw, options = {}) {
    if (this.isNullValue(raw)) {
      return { valid: true, value: null, formatted: "NULL" };
    }

    let str = String(raw).trim();
    // Strip accidental surrounding matching quotes: 'text' or "text"
    if ((str.startsWith("'") && str.endsWith("'") && str.length >= 2) ||
        (str.startsWith('"') && str.endsWith('"') && str.length >= 2)) {
      str = str.slice(1, -1);
    }

    if (options.length && str.length > options.length) {
      return { 
        valid: false, 
        error: `Text length (${str.length}) exceeds VARCHAR(${options.length}) maximum.` 
      };
    }

    return { valid: true, value: str, formatted: str };
  },

  /**
   * Universal column value parser. Dispatches to the appropriate parser
   * based on the target column's schema data type.
   */
  parseColumnValue(rawValue, dataType = "VARCHAR") {
    const { baseType, precision, scale, length } = this.normalizeType(dataType);

    switch (baseType) {
      case "INT":
        return { ...this.parseInteger(rawValue), baseType };
      case "DECIMAL":
      case "DOUBLE":
        return { ...this.parseDecimal(rawValue, { precision, scale }), baseType };
      case "DATE":
        return { ...this.parseDate(rawValue), baseType };
      case "DATETIME":
        return { ...this.parseDateTime(rawValue), baseType };
      case "BOOLEAN":
        return { ...this.parseBoolean(rawValue), baseType };
      case "VARCHAR":
      default:
        return { ...this.parseVarchar(rawValue, { length }), baseType };
    }
  },

  /**
   * Retrieves the defined SQL data type for a given table column.
   */
  getColumnType(tableName, columnName, schemaTables = []) {
    if (!schemaTables || !Array.isArray(schemaTables)) return "VARCHAR";
    const tbl = schemaTables.find(t => t.table_name === tableName);
    if (!tbl || !tbl.columns) return "VARCHAR";
    const col = tbl.columns.find(c => c.column_name === columnName);
    return col ? (col.data_type || "VARCHAR") : "VARCHAR";
  },

  /**
   * Validates and normalizes all rows for a single table.
   */
  validateTableData(tableName, rows = [], schemaTables = []) {
    const errors = [];
    const normalizedRows = [];

    if (!Array.isArray(rows)) {
      return {
        valid: false,
        errors: [{ row: 0, col: "*", error: `Table '${tableName}' rows must be an array.` }],
        normalizedRows: []
      };
    }

    rows.forEach((rowObj, rIdx) => {
      const newRow = {};
      Object.keys(rowObj || {}).forEach(colName => {
        const rawVal = rowObj[colName];
        const colType = this.getColumnType(tableName, colName, schemaTables);
        const res = this.parseColumnValue(rawVal, colType);

        if (!res.valid) {
          errors.push({
            table: tableName,
            row: rIdx,
            col: colName,
            error: res.error,
            value: rawVal,
            dataType: colType
          });
          newRow[colName] = rawVal;
        } else {
          newRow[colName] = res.value;
        }
      });
      normalizedRows.push(newRow);
    });

    return {
      valid: errors.length === 0,
      errors,
      normalizedRows
    };
  },

  /**
   * Validates and normalizes all tables within a testcase input_data object.
   */
  validateAllTables(inputData = {}, schemaTables = []) {
    const allErrors = [];
    const normalizedData = {};

    if (!inputData || typeof inputData !== "object") {
      return {
        valid: false,
        errors: [{ table: "*", row: 0, col: "*", error: "Input data must be an object with table names as keys." }],
        normalizedData: {}
      };
    }

    Object.keys(inputData).forEach(tblName => {
      const rows = inputData[tblName];
      const tableRes = this.validateTableData(tblName, rows, schemaTables);
      if (!tableRes.valid) {
        allErrors.push(...tableRes.errors);
      }
      normalizedData[tblName] = tableRes.normalizedRows;
    });

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      normalizedData
    };
  }
};
