#!/usr/bin/env python3
"""Round-4 per-component gate table (BOTH surfaces) — html-vs-real (the
computed floor's fidelity gate) and canvas-vs-real (the canvas pixel gate).
Reads committed receipts only; prints the owner-facing markdown table."""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
FLOOR = os.path.join(ROOT, 'extract', 'computed', 'out')
CANVAS = os.path.join(ROOT, 'examples', 'polaris', 'receipts', 'canvas-gate')

COMPONENTS = [
    ('button', 'button'), ('badge', 'badge'), ('tag', 'tag'), ('banner', 'banner'),
    ('checkbox', 'checkbox'), ('radiobutton', 'radio-button'), ('avatar', 'avatar'),
    ('spinner', 'spinner'), ('progressbar', 'progress-bar'), ('thumbnail', 'thumbnail'),
    ('text', 'text'), ('textfield', 'text-field'),
]

rows = []
for floor_dir, kebab in COMPONENTS:
    f = os.path.join(FLOOR, floor_dir, 'scorecard.json')
    html = '—'
    computed = '—'
    if os.path.exists(f):
        sc = json.load(open(f))
        p = sc['pixel']
        computed = f"{sc['computed']['pctEqual']:.1f}%"
        html = f"{p['meanExact']:.2f}% / {p['meanAA']:.2f}% (max {p['maxAA']:.2f}%, n={p['pairs']})"
    c = os.path.join(CANVAS, f'{kebab}.scorecard.json')
    canvas = '—'
    if os.path.exists(c):
        sc = json.load(open(c))
        s = sc['summary']
        acc = sc['acceptance']
        ok = 'PASS' if (s['meanAAMasked'] <= 5 and acc['allCellsOver10Named'] and acc.get('noBlankCanvasCells', True)) else 'FAIL'
        canvas = f"{s['meanAAMasked']:.2f}% masked mean (max {s['maxAAMasked']:.2f}%, n={s['cells']}) {ok}"
    rows.append((kebab, computed, html, canvas))

print('| component | computed-equality (html gate) | html-vs-real pixel exact/AA mean | canvas-vs-real (masked) |')
print('|---|---|---|---|')
for r in rows:
    print(f'| {r[0]} | {r[1]} | {r[2]} | {r[3]} |')
