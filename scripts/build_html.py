#!/usr/bin/env python3
"""build_html.py — Component-based HTML Assembler for SQLMaster (MyBench)

Divides and reassembles index.html from modular component and page templates:
  - web/static/templates/head.html
  - web/static/templates/navbar.html
  - web/static/templates/drawer.html
  - web/static/templates/views/practice.html
  - web/static/templates/views/home.html
  - web/static/templates/views/notes.html
  - web/static/templates/views/settings.html
  - web/static/templates/modals.html
  - web/static/templates/foot.html

Outputs:
  - web/static/index.html
  - docs/index.html

Zero build tools needed: Pure standard-library Python.
Supports optional --watch flag for automatic recompilation on template edit.
"""

from __future__ import annotations
import os
import sys
import time
import shutil

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STATIC_DIR = os.path.join(ROOT_DIR, "web", "static")
TEMPLATES_DIR = os.path.join(STATIC_DIR, "templates")
DOCS_DIR = os.path.join(ROOT_DIR, "docs")
DOCS_TEMPLATES_DIR = os.path.join(DOCS_DIR, "templates")

TEMPLATE_PARTS = [
    ("head.html", "Document Head, Meta, Font & CSS Links"),
    ("navbar.html", "Top Navigation Bar (SQLMaster Header)"),
    ("drawer.html", "Problem Drawer Slide-out & Overlay"),
    ("__views_start__", "Views Wrapper Opening"),
    ("views/practice.html", "View 1: Practice Workspace"),
    ("views/home.html", "View 2: Home Dashboard"),
    ("views/insights.html", "View: Progress Insights"),
    ("views/notes.html", "View 3: Personal Notes Hub"),
    ("views/settings.html", "View 4: Settings & Preferences"),
    ("__views_end__", "Views Wrapper Closing"),
    ("modals.html", "Modals, Popovers, Overlays & Toasts"),
    ("foot.html", "Scripts & Document Close"),
]


def assemble_html() -> str:
    """Reads all component templates and returns assembled index.html content."""
    pieces = []
    
    for item, description in TEMPLATE_PARTS:
        if item == "__views_start__":
            pieces.append("  <!-- Views Wrapper -->\n  <div class=\"views-wrapper\">\n")
            continue
        elif item == "__views_end__":
            pieces.append("  </div>\n\n")
            continue
            
        tmpl_path = os.path.join(TEMPLATES_DIR, item)
        if not os.path.exists(tmpl_path):
            raise FileNotFoundError(f"Missing required template part: {tmpl_path}")
            
        with open(tmpl_path, "r", encoding="utf-8") as f:
            content = f.read()
            if not content.endswith("\n"):
                content += "\n"
            pieces.append(content)
            
    return "".join(pieces)


def build_and_sync(verbose: bool = True) -> int:
    """Builds index.html for both web/static and docs, and synchronizes assets."""
    assembled = assemble_html()
    
    # 1. Write web/static/index.html
    static_index = os.path.join(STATIC_DIR, "index.html")
    with open(static_index, "w", encoding="utf-8") as f:
        f.write(assembled)
        
    # 2. Write docs/index.html
    docs_index = os.path.join(DOCS_DIR, "index.html")
    with open(docs_index, "w", encoding="utf-8") as f:
        f.write(assembled)
        
    # 3. Sync templates to docs/templates
    if os.path.exists(TEMPLATES_DIR):
        os.makedirs(DOCS_TEMPLATES_DIR, exist_ok=True)
        for root, dirs, files in os.walk(TEMPLATES_DIR):
            rel_dir = os.path.relpath(root, TEMPLATES_DIR)
            target_dir = os.path.join(DOCS_TEMPLATES_DIR, rel_dir) if rel_dir != "." else DOCS_TEMPLATES_DIR
            os.makedirs(target_dir, exist_ok=True)
            for f in files:
                shutil.copy2(os.path.join(root, f), os.path.join(target_dir, f))
                
    if verbose:
        line_count = assembled.count("\n") + 1
        print(f"✓ Assembled {line_count} lines of modular HTML into:")
        print(f"    - {os.path.relpath(static_index, ROOT_DIR)}")
        print(f"    - {os.path.relpath(docs_index, ROOT_DIR)}")
    return 0


def watch_templates(poll_interval: float = 1.0) -> None:
    """Watches templates directory for changes and auto-rebuilds."""
    print(f"Watching {TEMPLATES_DIR} for changes (poll: {poll_interval}s)... Press Ctrl+C to stop.")
    mtimes = {}
    
    def get_all_mtimes():
        current = {}
        for root, _, files in os.walk(TEMPLATES_DIR):
            for f in files:
                p = os.path.join(root, f)
                try:
                    current[p] = os.path.getmtime(p)
                except OSError:
                    pass
        return current
        
    mtimes = get_all_mtimes()
    build_and_sync(verbose=False)
    
    try:
        while True:
            time.sleep(poll_interval)
            current = get_all_mtimes()
            changed = [p for p, m in current.items() if mtimes.get(p) != m]
            if changed:
                for p in changed:
                    print(f"[{time.strftime('%H:%M:%S')}] Detected change in {os.path.basename(p)}")
                build_and_sync(verbose=True)
                mtimes = current
    except KeyboardInterrupt:
        print("\nWatcher stopped.")


if __name__ == "__main__":
    if "--watch" in sys.argv:
        watch_templates()
    else:
        build_and_sync(verbose=True)
