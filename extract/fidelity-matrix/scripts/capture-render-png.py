#!/usr/bin/env python3
"""Step 3b — screenshot each subject's emitted preview.html (the emitHtml
surface composed with tokens.css + minted token CSS) to out/<id>/render.png.

Subjects whose emitHtml REFUSED have no preview.html and are skipped — the
refusal is the recorded result, not a missing screenshot.

Run with a python that has playwright installed:
  python3 extract/fidelity-matrix/scripts/capture-render-png.py
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.path.join(os.path.dirname(__file__), "..", "out")

# ms-playwright cache may only hold a full chromium (no headless_shell for
# this playwright version) — point at it explicitly when present.
KNOWN_EXE = os.path.expanduser(
    "~/Library/Caches/ms-playwright/chromium-1155/chrome-mac/Chromium.app/Contents/MacOS/Chromium"
)

targets = sorted(
    d for d in os.listdir(BASE) if os.path.exists(os.path.join(BASE, d, "preview.html"))
)
print("targets:", targets)

launch_kwargs = {}
if os.path.exists(KNOWN_EXE):
    launch_kwargs["executable_path"] = KNOWN_EXE

with sync_playwright() as pw:
    browser = pw.chromium.launch(**launch_kwargs)
    page = browser.new_page(viewport={"width": 860, "height": 600})
    for d in targets:
        page.goto("file://" + os.path.abspath(os.path.join(BASE, d, "preview.html")))
        page.wait_for_timeout(300)
        out = os.path.join(BASE, d, "render.png")
        page.screenshot(path=out, full_page=True)
        print(d, "render.png", os.path.getsize(out) // 1024, "KB")
    browser.close()
