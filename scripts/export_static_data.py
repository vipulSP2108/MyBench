"""Exports questions database into static JSON files for GitHub Pages and offline hosting."""

from __future__ import annotations
import os
import sys
import json
import decimal
import datetime
from typing import Any

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from cli import load_all_questions


class DecimalEncoder(json.JSONEncoder):
    def default(self, o: Any) -> Any:
        if isinstance(o, decimal.Decimal):
            return float(o)
        if isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        return super().default(o)


def export_static_data():
    questions = load_all_questions()
    print(f"Loaded {len(questions)} questions from questions/ directory.")

    summary = []
    all_details = {}

    for q in questions:
        slug = q.get("slug")
        if not slug:
            continue

        public_test_cases = []
        for tc in q.get("test_cases", []):
            public_test_cases.append({
                "test_case_id": tc.get("test_case_id"),
                "description": tc.get("description", ""),
                "category": tc.get("category", "normal"),
                "input_data": tc.get("input_data", {}),
                "expected_output": tc.get("expected_output", [])
            })

        summary.append({
            "question_id": q.get("question_id"),
            "slug": slug,
            "title": q.get("title"),
            "difficulty": q.get("difficulty", "Easy"),
            "company": q.get("company", ""),
            "tags": q.get("tags", []),
            "test_case_count": len(public_test_cases)
        })

        all_details[slug] = {
            "question_id": q.get("question_id"),
            "slug": slug,
            "title": q.get("title"),
            "difficulty": q.get("difficulty", "Easy"),
            "company": q.get("company", ""),
            "question": q.get("question", ""),
            "notes": q.get("notes", []),
            "tables": q.get("tables", []),
            "sample_data": q.get("sample_data", {}),
            "expected_output": q.get("expected_output") or q.get("sample_output") or [],
            "tags": q.get("tags", []),
            "order_sensitive": q.get("order_sensitive", False),
            "reference_sql": q.get("reference_sql", ""),
            "test_case_count": len(public_test_cases),
            "test_cases": public_test_cases
        }

    # Target directories: web/static/data and docs/data
    dest_dirs = [
        os.path.join(PROJECT_ROOT, "web", "static", "data"),
        os.path.join(PROJECT_ROOT, "docs", "data")
    ]

    for dest in dest_dirs:
        os.makedirs(dest, exist_ok=True)
        q_path = os.path.join(dest, "questions.json")
        qa_path = os.path.join(dest, "questions-all.json")

        with open(q_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, cls=DecimalEncoder)

        with open(qa_path, "w", encoding="utf-8") as f:
            json.dump(all_details, f, cls=DecimalEncoder)

        print(f"Exported static data to {dest}")
        print(f"  - questions.json: {os.path.getsize(q_path) / 1024:.1f} KB")
        print(f"  - questions-all.json: {os.path.getsize(qa_path) / 1024:.1f} KB")


if __name__ == "__main__":
    export_static_data()
