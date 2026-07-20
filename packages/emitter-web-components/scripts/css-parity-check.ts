/**
 * CROSS-EMITTER CONSISTENCY RECEIPT — render the emitted Web Component demo
 * in real Chromium next to core/emit-html.ts's render of the SAME contract,
 * and computed-compare the component root across every showcase item
 * (default + every enum value + every boolean): 9 computed-style channels +
 * the bounding box (width/height) per item.
 *
 * The claim under test: the shadow-scoped selector translation (see
 * src/emit-wc.ts) resolves the cascade exactly like emit-html's class rules
 * — same tokens, same modifiers, same state chrome — so two emitters
 * produce ONE computed truth from one contract.
 *
 * Subjects: ds.badge, ds.button, ds.switch (repo contracts — the repo token
 * stylesheet src/styles/tokens.css supplies the custom-property values on
 * both pages; custom properties inherit through the shadow boundary).
 *
 * Needs playwright-core + a Chromium (the CERTIFICATION convention:
 * `npx playwright install chromium`); degrades by name otherwise.
 *
 * Run: npx tsx packages/emitter-web-components/scripts/css-parity-check.ts
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { chromiumExecutable } from '../../../extract/figma/visual-parity/render.js';
import { ContractSchema, type Contract } from '../../schema/src/contract-schema.js';
import { emitHtml } from '../../../core/emit-html.js';
import { tokenInventoryFromJson } from '../../../core/tokens.js';
import { kebab } from '../../../extract/types.js';
import { emitWebComponent, tagOf } from '../src/emit-wc.js';

const ROOT = process.cwd();
const SUBJECTS = ['ds.badge', 'ds.button', 'ds.switch'];
const CHANNELS = [
  'display',
  'background-color',
  'color',
  'padding-left',
  'padding-top',
  'border-top-left-radius',
  'font-size',
  'font-weight',
  'opacity',
] as const;

const readJson = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const contracts = new Map<string, Contract>(
  readdirSync(path.join(ROOT, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .map((f) => ContractSchema.parse(readJson(path.join('contracts', f))))
    .map((c) => [c.id, c]),
);
const icons = new Map<string, string>(
  readdirSync(path.join(ROOT, 'assets', 'icons'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim()]),
);
const tokenInventory = tokenInventoryFromJson([
  readJson('tokens/primitives.tokens.json'),
  readJson('tokens/semantic.tokens.json'),
  readJson('tokens/modes/semantic.light.tokens.json'),
  readJson('tokens/modes/semantic.dark.tokens.json'),
]);
const tokensCss = readFileSync(path.join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8');

interface ItemResult {
  label: string;
  mismatches: string[];
  compared: number;
}

const failures: string[] = [];
let totalItems = 0;
let totalComparisons = 0;

const work = mkdtempSync(path.join(os.tmpdir(), 'wc-parity-'));
try {
  const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
  try {
    const page = await browser.newPage();
    for (const id of SUBJECTS) {
      const contract = contracts.get(id)!;
      const tag = tagOf(contract);
      const k = kebab(contract.name);

      // ---- surface A: the html emitter -----------------------------------
      const { html, css } = emitHtml(contract, { tokens: tokenInventory, icons, contracts });
      const htmlDoc = `<!doctype html><html><head><meta charset="utf-8"><style>${tokensCss}</style><style>${css}</style></head><body>${html}</body></html>`;

      // ---- surface B: the web-components emitter (compiled + inlined) ----
      const wc = emitWebComponent(contract, { icons, contracts });
      writeFileSync(path.join(work, `${tag}.ts`), wc.element);
      writeFileSync(path.join(work, `${tag}.css.ts`), wc.stylesheet);
      const bundled = await build({
        entryPoints: [path.join(work, `${tag}.ts`)],
        bundle: true,
        format: 'esm',
        platform: 'browser',
        write: false,
        logLevel: 'silent',
      });
      const js = bundled.outputFiles[0].text;
      const wcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>${tokensCss}</style></head><body>${wc.demo.replace(
        `<script type="module" src="./${tag}.js"></script>`,
        '',
      )}<script type="module">${js.replace(/<\/script>/g, '<\\/script>')}</script></body></html>`;

      // ---- measure both --------------------------------------------------
      await page.setContent(htmlDoc, { waitUntil: 'load' });
      const a = await page.evaluate(
        ({ rootCls, channels }) =>
          [...document.querySelectorAll('.showcase__item')].map((item) => {
            const el = item.querySelector(`.${rootCls}`) as HTMLElement;
            const cs = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
              label: (item.querySelector('.showcase__label') as HTMLElement).textContent ?? '',
              styles: Object.fromEntries(channels.map((c) => [c, cs.getPropertyValue(c)])),
              width: Math.round(rect.width * 100) / 100,
              height: Math.round(rect.height * 100) / 100,
            };
          }),
        { rootCls: k, channels: CHANNELS as unknown as string[] },
      );

      await page.setContent(wcDoc, { waitUntil: 'load' });
      await page.evaluate((t) => customElements.whenDefined(t), tag);
      const b = await page.evaluate(
        ({ tag, channels }) =>
          [...document.querySelectorAll('.showcase__item')].map((item) => {
            const host = item.querySelector(tag) as HTMLElement;
            const el = host.shadowRoot!.querySelector("[part='root']") as HTMLElement;
            const cs = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
              label: (item.querySelector('.showcase__label') as HTMLElement).textContent ?? '',
              styles: Object.fromEntries(channels.map((c) => [c, cs.getPropertyValue(c)])),
              width: Math.round(rect.width * 100) / 100,
              height: Math.round(rect.height * 100) / 100,
            };
          }),
        { tag, channels: CHANNELS as unknown as string[] },
      );

      // ---- diff ----------------------------------------------------------
      console.log(`\n${contract.name} (${id}): html showcase ${a.length} item(s) vs <${tag}> demo ${b.length} item(s)`);
      if (a.length !== b.length || a.length === 0) {
        failures.push(`${id}: showcase item count mismatch (html ${a.length} vs wc ${b.length})`);
        console.log(`  ✖ item count mismatch (html ${a.length} vs wc ${b.length})`);
        continue;
      }
      const results: ItemResult[] = a.map((ia, i) => {
        const ib = b[i];
        const mismatches: string[] = [];
        let compared = 0;
        if (ia.label !== ib.label) mismatches.push(`label: "${ia.label}" vs "${ib.label}"`);
        for (const c of CHANNELS) {
          compared++;
          if (ia.styles[c] !== ib.styles[c]) mismatches.push(`${c}: "${ia.styles[c]}" vs "${ib.styles[c]}"`);
        }
        for (const dim of ['width', 'height'] as const) {
          compared++;
          if (ia[dim] !== ib[dim]) mismatches.push(`${dim}: ${ia[dim]} vs ${ib[dim]}`);
        }
        return { label: ia.label, mismatches, compared };
      });
      for (const r of results) {
        totalItems++;
        totalComparisons += r.compared;
        if (r.mismatches.length === 0) {
          console.log(`  ✔ [${r.label}] ${r.compared}/${r.compared} channels match (9 computed + width/height)`);
        } else {
          failures.push(`${id} [${r.label}]: ${r.mismatches.join('; ')}`);
          console.log(`  ✖ [${r.label}] ${r.mismatches.length} mismatch(es): ${r.mismatches.join('; ')}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n✖ wc-emitter-css-parity: ${failures.length} mismatch group(s)`);
  process.exit(1);
}
console.log(
  `\n✔ wc-emitter-css-parity: ${SUBJECTS.length} subjects, ${totalItems} showcase items, ${totalComparisons} channel comparisons, 0 mismatches — one contract, one computed truth across emitters`,
);
