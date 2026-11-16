# Contributing to MyBench

Thank you for your interest in contributing to **MyBench**! 

MyBench is a community-driven, open-source SQL practice and validation benchmark suite built under the [Non-Commercial License](LICENSE). Every question definition, test dataset, and engine script is open and transparent. All queries execute client-side via WebAssembly or in-memory locally, with complete data sovereignty for the user.

Whether you are fixing a typo, refining a SQL solution, adding boundary edge test cases, or developing new interface features, every contribution helps build a stronger practice platform for everyone.

> [!TIP]
> If you are setting up or self-hosting the project locally for development or offline practice, see our [Local Setup & Self-Hosting Guide (LOCAL_HOSTING.md)](LOCAL_HOSTING.md).

---

## 🌟 Ways to Contribute

There are many ways you can help improve MyBench:

1. **Report Bugs & Edge Case Discrepancies**: Found a question where a valid MySQL solution fails, or an incorrect reference solution passes? Let us know!
2. **Contribute New Interview Questions**: Add real-world SQL interview problems asked by top tech companies.
3. **Enhance Test Suites**: Add tricky edge cases (e.g. ties, NULLs, empty tables, leap years, timezone boundaries) to existing questions.
4. **Improve the Web Platform**: Enhance the SPA, UI accessibility, keyboard shortcuts, or themes.
5. **Documentation**: Improve guides, explanations, and solution breakdowns for learners.

---

## 🐛 Reporting Issues & Bugs

If you find an issue or have a feature idea, please open a ticket on GitHub:
👉 **[Open a GitHub Issue](https://github.com/vipulSP2108/MyBench/issues/new/choose)**

### How to Write a Great Issue:
* **Clear Title**: Summarize the problem or question slug (e.g., `[Bug] Order sensitivity on '2nd-ride-delay'`).
* **Description**: Explain what happened vs. what was expected.
* **SQL Query**: If reporting an execution or validation issue, include your SQL query and the expected vs. actual output.
* **Environment**: Note whether you experienced it on the web (GitHub Pages) or locally via the Python CLI.

### Issue Labels & Tags Taxonomy:
When creating or triaging issues, the following tags are used so developers can easily find tasks to work on:
* `bug`: Something isn't working as intended.
* `question-request`: Proposal for a new interview question.
* `edge-case`: Missing edge cases or boundary test conditions.
* `enhancement`: Feature request or UI/UX improvement.
* `good first issue`: Ideal tasks for beginners looking to contribute.
* `documentation`: Improvements to README, guides, or question descriptions.
* `sql-engine`: Engine execution, dialect transpilation, or DuckDB/MySQL compatibility.

> 💡 **For Developers**: If you want to solve an open issue, comment on the issue saying *"I would like to work on this!"* to claim it, and we will assign it to you.

---

## 💻 Local Development Setup

### 1. Clone Your Fork
```bash
git clone https://github.com/<your-username>/MyBench.git
cd MyBench
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```
*(Dependencies are minimal: `duckdb`, `sqlglot`, `pymysql`)*

### 3. Launch the Local Web Platform
```bash
python3 cli.py serve
```
Open **http://127.0.0.1:8080** in your browser.

---

## 🧪 Testing & Quality Gates

Before submitting any Pull Request, ensure all automated verification gates pass:

```bash
# 1. Run the comprehensive quality gates test (verifies schemas, MySQL types, test counts)
python3 test_quality_gates.py

# 2. Run the full validation suite across all 100 questions
python3 cli.py validate-all

# 3. If you modified questions/*.json, update the static web cache
python3 scripts/export_static_data.py

# 4. Copy updated assets to docs/ (for GitHub Pages)
cp web/static/app.js docs/app.js
cp web/static/style.css docs/style.css
cp web/static/index.html docs/index.html
```

---

## 📥 Submitting a Pull Request (PR)

1. **Create a Topic Branch**:
   ```bash
   git checkout -b fix/issue-description
   # or
   git checkout -b feat/new-question-name
   ```
2. **Commit Your Changes**:
   Write clear, concise commit messages:
   ```bash
   git commit -m "fix(questions): Add missing tie-breaker edge case to yoy-growth-rate"
   ```
3. **Push to Your Fork**:
   ```bash
   git push origin fix/issue-description
   ```
4. **Open a Pull Request**:
   Go to **[https://github.com/vipulSP2108/MyBench/pulls](https://github.com/vipulSP2108/MyBench/pulls)** and click **New pull request**.
   - Fill out the PR template describing the changes made.
   - Reference any linked issues (e.g. `Fixes #12`).
   - Confirm that `python3 test_quality_gates.py` and `python3 cli.py validate-all` pass cleanly.

---

## 🤝 Code of Conduct & Review Process

* We review and test all Pull Requests promptly.
* Be respectful, constructive, and supportive in code reviews and discussions.
* Once approved, your PR will be merged into `main` and automatically published to the live GitHub Pages platform!

**Thank you for helping empower thousands of candidates to learn SQL freely! 💙**
