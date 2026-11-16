# Local Setup & Self-Hosting Guide

> [!TIP]
> **Recommended Option**: We recommend practicing via the official community web build at **[vipulsp2108.github.io/MyBench/](https://vipulsp2108.github.io/MyBench/)**.  
> It runs 100% client-side directly inside your browser via WebAssembly (DuckDB-Wasm) with zero installation, zero tracking, and complete offline persistence in `localStorage`.
>
> You are also warmly welcome to explore the codebase, report edge cases, and contribute improvements back to the community via [GitHub](https://github.com/vipulSP2108/MyBench)!

If you prefer to run, customize, or self-host MyBench on your own machine—whether for offline study, air-gapped environments, or developing new questions—follow any of the straightforward methods below.

---

## Architecture & Local Privacy Guarantees

MyBench is designed from the ground up to respect data sovereignty:

* **Zero Remote Telemetry**: No Google Analytics, no tracking pixels, no external cookies, and no third-party CDNs required for execution.
* **Client-Side / In-Memory Execution**:
  * In the browser, SQL runs inside a WebAssembly sandbox (DuckDB-Wasm) in your browser's private memory.
  * In the local Python server, queries execute in ephemeral in-memory SQLite instances (`:memory:`). Queries and result sets are never written to disk or logged.
* **100% Local Data Persistence**: Your SQL drafts, personal notes, bookmarks, and solved checklists are saved strictly to your browser's `localStorage`. You can export your entire state to a standalone JSON file at any time from the Settings drawer.

---

## Option 1: Static Local Server (Zero Dependencies)

Because the web platform is built as a static Single Page Application (SPA), you can host it locally using standard tools already installed on macOS, Linux, or Windows with zero package installation.

### Step 1: Clone the Repository
```bash
git clone https://github.com/vipulSP2108/MyBench.git
cd MyBench
```

### Step 2: Serve the Static `docs/` Directory
Use Python's built-in HTTP server:
```bash
python3 -m http.server 8000 --directory docs
```
*(Or if using Node.js: `npx serve docs`)*

### Step 3: Open in Browser
Visit **`http://localhost:8000`**.  
The application will load the bundled 100 MySQL 8.0 interview problems from `docs/data/` and execute all test cases locally via WebAssembly.

---

## Option 2: Python Development Server (Full Environment)

If you plan to author new questions, modify `questions/*.json`, or develop backend extensions, run the Python development server.

### Step 1: Clone and Set Up Virtual Environment
```bash
git clone https://github.com/vipulSP2108/MyBench.git
cd MyBench

python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
```

### Step 2: Install Minimal Dependencies
```bash
pip install -r requirements.txt
```
*(Dependencies are lightweight: `duckdb`, `sqlglot`, and `pymysql` for ANSI dialect parsing and validation.)*

### Step 3: Start the Development Server
```bash
python3 cli.py serve
```
Open **`http://127.0.0.1:8080`** in your browser. The server provides live question reloads directly from `questions/*.json` and REST endpoints for reference derivation.

---

## Option 3: Terminal CLI Mode (No Browser Required)

You can solve and validate questions entirely within your terminal without opening a browser.

### List Available Questions
```bash
# List all questions
python3 cli.py list

# Filter by difficulty or topic tag
python3 cli.py list --difficulty easy
python3 cli.py list --tag window-functions
```

### Inspect a Question
```bash
python3 cli.py show matching-skills
```
Displays problem description, schemas, constraints, and baseline sample rows.

### Test Your Solution Against Edge Test Cases
```bash
python3 cli.py run matching-skills --sql "SELECT candidate_id FROM candidates WHERE skill IN ('Python', 'Tableau', 'PostgreSQL') GROUP BY candidate_id HAVING COUNT(DISTINCT skill) = 3 ORDER BY candidate_id ASC;"
```

### Validate Benchmark Integrity
```bash
# Validate reference solution for a single question
python3 cli.py validate matching-skills

# Run automated validation across all 100 questions
python3 cli.py validate-all

# Execute automated quality gates
python3 test_quality_gates.py
```

---

## Re-bundling Static Assets after Local Edits

If you add new questions to `questions/*.json` or edit existing schemas, re-compile the static JSON bundles for the browser build:

```bash
# 1. Export static database bundles
python3 scripts/export_static_data.py

# 2. Sync UI assets to docs/ directory
cp web/static/app.js docs/app.js
cp web/static/style.css docs/style.css
cp web/static/index.html docs/index.html

# 3. Verify quality gates pass
python3 test_quality_gates.py
```

---

## Contributing Your Improvements

If you discovered an edge-case improvement, refined a reference query, or built a new feature during local development, please share it back with the community!

See our [Contribution Guidelines (CONTRIBUTING.md)](CONTRIBUTING.md) for pull request workflows and automated quality gate checks.
