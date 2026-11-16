#!/usr/bin/env python3
"""
Question Diff & Cache Utility
Inspect, diff, and synchronize question definitions with local cache.
"""

import difflib
import glob
import json
import os
import sys

CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".local_cache", "questions"))
QUESTIONS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "questions"))

def load_json(path):
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def show_question(slug):
    path = os.path.join(CACHE_DIR, f"{slug}.json")
    data = load_json(path)
    if not data:
        print(f"Error: Cached question '{slug}' not found.")
        return
    print(f"\n=== Question: {slug} (Cached) ===")
    print(data.get("question", ""))
    if data.get("notes"):
        print("\n--- Notes ---")
        for n in data["notes"]:
            print(f"• {n}")

def diff_question(slug):
    cache_path = os.path.join(CACHE_DIR, f"{slug}.json")
    curr_path = os.path.join(QUESTIONS_DIR, f"{slug}.json")

    cache_data = load_json(cache_path)
    curr_data = load_json(curr_path)

    if not cache_data:
        print(f"Cached file for '{slug}' not found.")
        return
    if not curr_data:
        print(f"Current file for '{slug}' not found.")
        return

    cache_text = cache_data.get("question", "").splitlines(keepends=True)
    curr_text = curr_data.get("question", "").splitlines(keepends=True)

    diff = list(difflib.unified_diff(
        cache_text, curr_text,
        fromfile=f"cache/{slug}",
        tofile=f"current/{slug}",
        n=2
    ))

    if not diff:
        print(f"'{slug}': Identical question text.")
    else:
        print(f"\n=== Diff for '{slug}' ===")
        sys.stdout.writelines(diff)

def restore_question(target):
    if target == "all":
        count = 0
        for f in glob.glob(os.path.join(CACHE_DIR, "*.json")):
            basename = os.path.basename(f)
            dest = os.path.join(QUESTIONS_DIR, basename)
            with open(f, "r", encoding="utf-8") as src_f, open(dest, "w", encoding="utf-8") as dst_f:
                dst_f.write(src_f.read())
            count += 1
        print(f"Restored all {count} questions from cache.")
    else:
        slug = target.replace(".json", "")
        src = os.path.join(CACHE_DIR, f"{slug}.json")
        dest = os.path.join(QUESTIONS_DIR, f"{slug}.json")
        if not os.path.exists(src):
            print(f"Error: Cached record for '{slug}' does not exist.")
            return
        with open(src, "r", encoding="utf-8") as src_f, open(dest, "w", encoding="utf-8") as dst_f:
            dst_f.write(src_f.read())
        print(f"Restored '{slug}' from cache.")

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 scripts/question_diff.py show <slug>      - View cached question text")
        print("  python3 scripts/question_diff.py diff <slug>      - Compare cached vs current")
        print("  python3 scripts/question_diff.py restore <slug>   - Restore from cache")
        print("  python3 scripts/question_diff.py restore all      - Restore all questions from cache")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "show" and len(sys.argv) >= 3:
        show_question(sys.argv[2])
    elif cmd == "diff" and len(sys.argv) >= 3:
        diff_question(sys.argv[2])
    elif cmd == "restore" and len(sys.argv) >= 3:
        restore_question(sys.argv[2])
    else:
        print(f"Unknown command or missing argument: {cmd}")

if __name__ == "__main__":
    main()
