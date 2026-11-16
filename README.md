# MyBench — Open-Source SQL Interview Practice Platform

An interactive, browser-based SQL practice platform and validation suite covering 100 MySQL 8.0 interview questions from top tech companies.

---

## Open-Source Architecture & Principles

**MyBench** is a community-driven, open-source initiative published under the [Non-Commercial License](LICENSE).

* **Fully Transparent**: Every question schema, reference solution, and test case dataset is publicly inspectable in [`questions/`](questions/).
* **Client-Side & In-Memory Execution**: SQL queries execute in your browser via WebAssembly (DuckDB-Wasm) or locally in an in-memory database (`:memory:`). Queries and result rows are never transmitted across the network or logged to external servers.
* **Local Data Sovereignty**: All user state—query drafts, personal notes, solved checklists, and starred problems—is stored exclusively in your browser's `localStorage` and can be exported as a standalone JSON backup anytime.
* **No Accounts or Tracking**: No registration, no tracking scripts, no analytics cookies, and no third-party telemetry.

---

## Getting Started

### 1. Recommended: Community Web Build (Zero Setup)
Practice immediately in your browser with full offline persistence:

👉 **[Launch Live Platform at vipulsp2108.github.io/MyBench/](https://vipulsp2108.github.io/MyBench/)**

### 2. Local Setup & Self-Hosting
If you prefer running offline, on an air-gapped machine, or developing new test cases locally:

👉 **[Read the Local Hosting Guide (LOCAL_HOSTING.md)](LOCAL_HOSTING.md)**

```bash
# Quick local static serve (no installation required)
python3 -m http.server 8000 --directory docs
```

---

## Contributing to the Project

MyBench is built and improved by the community. We welcome contributions of all kinds, including:

* 🔍 **Edge Case Discoveries**: Found a query where a valid MySQL 8.0 solution is marked incorrectly, or boundary values (NULLs, ties, empty inputs) are missing?
* 💡 **New Interview Problems**: Propose real-world SQL problems with schemas and test cases.
* 🛠️ **UI & Engine Enhancements**: Improve accessibility, shortcuts, themes, or dialect compatibility.

👉 **[Read the Contribution Guide (CONTRIBUTING.md)](CONTRIBUTING.md)** for local development setup, coding guidelines, and automated quality gate checks.

---

## Community Issue Tracker & Tags

We organize collaborative development and issue triaging through **GitHub Issues**:

👉 **[Browse or Open an Issue on GitHub](https://github.com/vipulSP2108/MyBench/issues)**

Community tags help developers find and claim tasks:

| Tag | Purpose |
| :--- | :--- |
| `good first issue` | Curated, accessible tasks for first-time contributors |
| `bug` | Discrepancies in question prompts, schemas, or platform behavior |
| `edge-case` | Missing edge conditions, boundary tests, or duplicate handling |
| `question-request` | Proposals for new SQL interview questions |
| `sql-engine` | Dialect compatibility, WebAssembly optimizations, or query execution |
| `enhancement` | Interface, shortcuts, or developer tool improvements |

To work on an open issue, leave a comment on the ticket to get assigned!

---

## Local Data & Privacy Guarantees

All user data lives **strictly inside your browser locally** and is never stored on or sent to remote servers:

| Data Type | Storage Location | Notes |
| :--- | :--- | :--- |
| **SQL Drafts** | Browser `localStorage` (`sqlmaster_draft_<slug>`) | Saved automatically as you type per question |
| **Personal Notes** | Browser `localStorage` (`sqlmaster_user_notes`) | Markdown-supported private study notes |
| **Solved & Attempted** | Browser `localStorage` (`sqlmaster_solved`, `sqlmaster_attempted`) | Progress tracking stored entirely on your device |
| **Bookmarks / Stars** | Browser `localStorage` (`sqlmaster_starred`) | Custom starred list for quick review |
| **User Settings** | Browser `localStorage` (`sqlmaster_settings`, `sqlmaster_theme`) | Plain mode, theme preferences, and editor keymaps |
| **Data Backup** | Direct JSON Export / Import | Backup and restore your complete state locally |

---

## Local Terminal CLI Practice

You can also solve and test problems directly in your terminal:

```bash
# List questions with optional filters
python3 cli.py list --difficulty easy --tag window-functions

# View question details and schemas
python3 cli.py show matching-skills

# Run and validate custom SQL
python3 cli.py run matching-skills --sql "SELECT candidate_id FROM candidates WHERE skill IN ('Python', 'Tableau', 'PostgreSQL') GROUP BY candidate_id HAVING COUNT(DISTINCT skill) = 3 ORDER BY candidate_id ASC;"

# Validate reference solutions and quality gates
python3 cli.py validate-all
python3 test_quality_gates.py
```

---

## ⚖️ Legal Disclaimer & Non-Affiliation

MyBench is an independent, community-driven open-source educational project and benchmark suite. All interview questions, schemas, and SQL logic represent standard technical interview problem concepts.

MyBench is **not** affiliated with, endorsed by, sponsored by, or associated with any commercial interview preparation services, testing platforms, or tech companies mentioned (such as Google, Amazon, Meta, Apple, Microsoft, Uber, or Tesla). All company trademarks, service marks, and trade names are the property of their respective owners and are referenced solely for identification, descriptive, and educational purposes.

---

## License

This project is licensed under the [MyBench Non-Commercial License](LICENSE).
