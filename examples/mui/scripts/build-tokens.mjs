/**
 * MUI token wrap — `node examples/mui/scripts/build-tokens.mjs`
 *
 * Builds the DTCG wrap + flat vars css from @mui/material's DEFAULT theme —
 * the theme that ships in the package and drives the docs look (the Astryx
 * lesson: capture the theme the world recognizes). Light + dark schemes via
 * createTheme({ colorSchemes }). Deterministic: values come from the pinned
 * package verbatim; spacing is the 8px unit expanded; shadows are the
 * package's own 25-level elevation ramp.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const req = createRequire(path.join(EX, '.mui-sandbox', 'package.json'));
const { createTheme } = req('@mui/material/styles');

const theme = createTheme({ colorSchemes: { light: true, dark: true } });
const light = theme.colorSchemes.light.palette;
const dark = theme.colorSchemes.dark.palette;

const base = {};
const modeLight = {};
const modeDark = {};
const kebab = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const put = (rawName, lv, dv, type) => {
  const name = kebab(rawName);
  base[name] = { $type: type, $value: String(lv) };
  if (String(lv) !== String(dv)) {
    modeLight[name] = { $value: String(lv) };
    modeDark[name] = { $value: String(dv) };
  }
};

const walkPalette = (l, d, prefix) => {
  for (const [k, lv] of Object.entries(l)) {
    const dv = d?.[k];
    if (typeof lv === 'string' && (lv.startsWith('#') || lv.startsWith('rgb') || lv.startsWith('hsl'))) {
      put(`palette-${prefix}${k}`, lv, typeof dv === 'string' ? dv : lv, 'color');
    } else if (lv && typeof lv === 'object') {
      walkPalette(lv, dv ?? {}, `${prefix}${k}-`);
    }
  }
};
walkPalette(light, dark, '');

for (let i = 0; i <= 12; i++) put(`spacing-${i}`, theme.spacing(i), theme.spacing(i), 'dimension');
for (const h of [0.5, 1.5, 2.5]) put(`spacing-${String(h).replace('.', '-')}`, theme.spacing(h), theme.spacing(h), 'dimension');

put('shape-border-radius', `${theme.shape.borderRadius}px`, `${theme.shape.borderRadius}px`, 'dimension');
for (const [variant, t] of Object.entries(theme.typography)) {
  if (!t || typeof t !== 'object' || !t.fontSize) continue;
  put(`font-${variant}-size`, t.fontSize, t.fontSize, 'dimension');
  if (t.fontWeight != null) put(`font-${variant}-weight`, t.fontWeight, t.fontWeight, 'number');
  if (t.lineHeight != null) put(`font-${variant}-line-height`, t.lineHeight, t.lineHeight, 'number');
  if (t.letterSpacing != null) put(`font-${variant}-letter-spacing`, t.letterSpacing, t.letterSpacing, 'dimension');
}
put('font-family-default', theme.typography.fontFamily, theme.typography.fontFamily, 'fontFamily');

theme.shadows.forEach((s, i) => { if (s !== 'none') put(`shadows-${i}`, s, s, 'shadow'); });

mkdirSync(path.join(EX, 'tokens', 'modes'), { recursive: true });
const write = (rel, data) => writeFileSync(path.join(EX, rel), JSON.stringify(data, null, 2) + '\n');
write('tokens/mui.dtcg.json', base);
write('tokens/modes/mui.light.dtcg.json', modeLight);
write('tokens/modes/mui.dark.dtcg.json', modeDark);

const flat = Object.keys(base).sort().map((k) => `  --${k}: ${base[k].$value};`);
writeFileSync(path.join(EX, 'tokens', 'mui.vars.css'), `:root {\n${flat.join('\n')}\n}\n`);
console.log(`✔ ${Object.keys(base).length} tokens wrapped (${Object.keys(modeLight).length} mode-varying) → examples/mui/tokens/`);
console.log(`  spot: palette-primary-main=${base['palette-primary-main'].$value} · shape-border-radius=${base['shape-border-radius'].$value} · spacing-1=${base['spacing-1'].$value}`);
