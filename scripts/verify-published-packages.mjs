/**
 * PUBLISHED-PACKAGE SMOKE — `npm run verify:published`.
 *
 * WHY THIS EXISTS. `npm run verify:package` imports the ROOT package's dist
 * (the private ds-contracts-poc component library) — it never touches the
 * four packages the registry serves. The project's v1 promise is "React +
 * web components in core, Vue/Svelte/Angular as LATER PLUGINS", which is only
 * true if an emitter can be built OUTSIDE this monorepo against published
 * packages. Until 2026-08-22 it could not: the Emitter type, the registry,
 * the token resolver and kebab lived only in root core/ and the
 * web-components README pointed at an unresolvable 'ds-contracts core'.
 *
 * WHAT IT PROVES, in a temp project with NO path back to this repo:
 *   1. build schema → core → emitter-web-components → cli, `npm pack` each;
 *   2. the core tarball's runtime dependency set is exactly
 *      {@ds-contracts/schema} and its dist imports no typescript / prettier /
 *      playwright / node:* — the dependency policy, refused by name;
 *   3. `npm install` the four tarballs (file: deps) into a temp project;
 *   4. a throwaway Vue emitter that imports ONLY @ds-contracts/core and
 *      @ds-contracts/schema resolves a contract's `{token.ref}`s to literals
 *      through flattenTokens + makeResolveLiteral, and
 *      `ds-contracts generate --emitter ./my-vue-emitter` over the Flowbite
 *      eight writes eight .vue files each carrying at least one resolved
 *      literal (a token that came back as a real value, not a dangling ref);
 *   5. `--target web-components --emitter @ds-contracts/emitter-web-components`
 *      from ITS tarball emits the same eight.
 *
 * No network is required beyond what `npm install` needs for schema's `zod`
 * (satisfied from the npm cache when present). Never publishes.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['schema', 'core', 'emitter-web-components', 'cli'];
const CORE_ALLOWED_DEPS = new Set(['@ds-contracts/schema']);
const CORE_FORBIDDEN_IMPORTS = /from\s+['"](typescript|prettier(\/[^'"]*)?|playwright(-core)?|node:[^'"]+|esbuild|react[^'"]*)['"]/;
const FLOWBITE = path.join(ROOT, 'examples', 'tailwind');
const FLOWBITE_EIGHT = ['alert', 'badge', 'button', 'card', 'helpertext', 'kbd', 'label', 'toggleswitch'];

const fail = (msg) => {
  console.error(`✗ verify:published — ${msg}`);
  process.exit(1);
};
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};
const keep = process.argv.includes('--keep');
const work = mkdtempSync(path.join(tmpdir(), 'ds-contracts-published-'));
const tarballs = path.join(work, 'tarballs');
const project = path.join(work, 'project');
mkdirSync(tarballs);
mkdirSync(project);
const cleanup = () => {
  if (keep) console.log(`  (kept ${work})`);
  else rmSync(work, { recursive: true, force: true });
};

// 1. build + pack, in dependency order.
const packed = {};
for (const name of PACKAGES) {
  const dir = path.join(ROOT, 'packages', name);
  const built = run('npm', ['--prefix', dir, 'run', 'build'], { cwd: ROOT });
  if (built.status !== 0) {
    cleanup();
    fail(`packages/${name} build failed:\n${built.out}`);
  }
  const out = execFileSync('npm', ['pack', '--json', '--pack-destination', tarballs], {
    cwd: dir,
    encoding: 'utf8',
  });
  const [info] = JSON.parse(out);
  packed[info.name] = { file: path.join(tarballs, info.filename), version: info.version, files: info.files.map((f) => f.path) };
  console.log(`  packed ${info.name}@${info.version} (${info.files.length} files)`);
}

// 2. dependency policy on the CORE tarball — extract and inspect.
{
  const extract = path.join(work, 'core-extract');
  mkdirSync(extract);
  execFileSync('tar', ['-xzf', packed['@ds-contracts/core'].file, '-C', extract]);
  const pkg = JSON.parse(readFileSync(path.join(extract, 'package', 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies ?? {});
  const extra = deps.filter((d) => !CORE_ALLOWED_DEPS.has(d));
  if (extra.length > 0 || pkg.peerDependencies || pkg.optionalDependencies) {
    cleanup();
    fail(`@ds-contracts/core may depend on ${[...CORE_ALLOWED_DEPS].join(', ')} only — found ${extra.join(', ') || 'peer/optional deps'}`);
  }
  const dist = path.join(extract, 'package', 'dist');
  for (const f of readdirSync(dist).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(path.join(dist, f), 'utf8');
    const hit = src.match(CORE_FORBIDDEN_IMPORTS);
    if (hit) {
      cleanup();
      fail(`@ds-contracts/core dist/${f} imports "${hit[1]}" — the package must stay pure (schema + zod only)`);
    }
  }
  console.log(`  core policy: deps = {${deps.join(', ')}}, dist imports clean`);
}

// 3. install the four tarballs into a project that has no path back here.
writeFileSync(
  path.join(project, 'package.json'),
  JSON.stringify(
    {
      name: 'ds-contracts-published-smoke',
      private: true,
      type: 'module',
      dependencies: Object.fromEntries(
        Object.entries(packed).map(([name, { file }]) => [name, `file:${path.relative(project, file)}`]),
      ),
    },
    null,
    2,
  ),
);
{
  const installed = run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline', '--loglevel=error'], { cwd: project });
  if (installed.status !== 0) {
    cleanup();
    fail(`npm install of the four tarballs failed:\n${installed.out}`);
  }
  for (const name of Object.keys(packed)) {
    const real = path.join(project, 'node_modules', ...name.split('/'));
    if (!existsSync(path.join(real, 'package.json'))) {
      cleanup();
      fail(`${name} did not install into the temp project`);
    }
  }
  // One schema, from the tarball: core's ^range must resolve to the packed
  // version, never a second copy from the registry.
  const nested = path.join(project, 'node_modules', '@ds-contracts', 'core', 'node_modules');
  if (existsSync(nested)) {
    cleanup();
    fail(`@ds-contracts/core pulled its own nested node_modules (${readdirSync(nested).join(', ')}) — the packed schema did not satisfy its range`);
  }
  console.log(`  installed ${Object.keys(packed).length} tarballs into ${project}`);
}

// 4. the throwaway Vue emitter — published packages only.
const emitterDir = path.join(project, 'my-vue-emitter');
mkdirSync(emitterDir);
writeFileSync(
  path.join(emitterDir, 'index.mjs'),
  `import { flattenTokens, kebab, makeResolveLiteral, tokenInventoryFromJson } from '@ds-contracts/core';
import { walkAnatomy } from '@ds-contracts/schema';

const REF = /^\\{([^}]+)\\}$/;

/** A Vue SFC per contract: every anatomy part's token channels resolved to
 *  LITERALS through @ds-contracts/core — the thing an emitter outside the
 *  monorepo could not do before the package existed. */
const vue = {
  name: 'vue',
  label: 'Vue SFC (throwaway published-package smoke)',
  emit(contract, ctx) {
    const all = new Map();
    for (const tree of [ctx.tokens.primitives, ctx.tokens.semantic, ctx.tokens.light]) {
      for (const [k, v] of flattenTokens(tree)) all.set(k, v);
    }
    const inventory = tokenInventoryFromJson([ctx.tokens.primitives, ctx.tokens.semantic, ctx.tokens.light, ctx.tokens.dark]);
    const literal = makeResolveLiteral(all);
    const rules = [];
    const unresolved = [];
    for (const { name, part } of walkAnatomy(contract)) {
      const decls = [];
      for (const [channel, ref] of Object.entries(part.tokens ?? {})) {
        const m = typeof ref === 'string' ? ref.match(REF) : null;
        if (!m) continue;
        if (!inventory.has(m[1])) { unresolved.push(m[1]); continue; }
        decls.push(channel + ': ' + String(literal(m[1])) + ';');
      }
      if (decls.length > 0) rules.push('.' + name + ' { ' + decls.join(' ') + ' }');
    }
    const tag = kebab(contract.name);
    const contents = [
      '<template>',
      '  <div class="root" data-component="' + tag + '"><slot /></div>',
      '</template>',
      '<script setup>',
      '// ' + contract.id + ' v' + contract.version + ' — ' + contract.props.length + ' props',
      '</script>',
      '<style scoped>',
      ...rules,
      '</style>',
      unresolved.length ? '<!-- unresolved: ' + [...new Set(unresolved)].join(', ') + ' -->' : '',
      '',
    ].join('\\n');
    return [{ path: tag + '.vue', contents }];
  },
};
export default vue;
`,
);

const cli = path.join(project, 'node_modules', '.bin', 'ds-contracts');
const contracts = FLOWBITE_EIGHT.map((stem) => path.join(FLOWBITE, 'contracts', `${stem}.contract.json`));
const tokens = [
  `primitives=${path.join(FLOWBITE, 'tokens', 'tailwind.dtcg.json')}`,
  `semantic=${path.join(FLOWBITE, 'tokens', 'tailwind-minted.dtcg.json')}`,
].join(',');
const icons = path.join(FLOWBITE, 'assets', 'icons');

const generate = (label, target, emitter, outDir) => {
  const r = run(cli, ['generate', ...contracts, '--out', outDir, '--target', target, '--emitter', emitter, '--tokens', tokens, '--icons', icons], { cwd: project });
  if (r.status !== 0) {
    cleanup();
    fail(`${label}: ds-contracts generate exited ${r.status}:\n${r.out}`);
  }
  if (!/Registered emitter "/.test(r.out)) {
    cleanup();
    fail(`${label}: the CLI never registered the plugin emitter:\n${r.out}`);
  }
  return r.out;
};

{
  const outDir = path.join(project, 'out-vue');
  generate('vue emitter', 'vue', './my-vue-emitter/index.mjs', outDir);
  const files = readdirSync(outDir).filter((f) => f.endsWith('.vue'));
  if (files.length !== FLOWBITE_EIGHT.length) {
    cleanup();
    fail(`vue emitter: expected ${FLOWBITE_EIGHT.length} .vue files, got ${files.length} (${files.join(', ')})`);
  }
  const LITERAL = /:\s*(#[0-9a-f]{3,8}|\d[\d.]*(px|rem|em|%)?|rgba?\(|oklch\(|[a-z-]+);/i;
  for (const f of files) {
    const src = readFileSync(path.join(outDir, f), 'utf8');
    if (/\{[a-z][\w.-]*\}/.test(src)) {
      cleanup();
      fail(`vue emitter: ${f} still carries an unresolved {token.ref}`);
    }
    if (!LITERAL.test(src)) {
      cleanup();
      fail(`vue emitter: ${f} resolved no token to a literal — @ds-contracts/core's resolver did not run`);
    }
  }
  console.log(`  vue emitter: ${files.length}/${FLOWBITE_EIGHT.length} .vue files, every {token.ref} resolved to a literal through @ds-contracts/core`);
}

// 5. the web-components emitter from ITS tarball.
{
  const outDir = path.join(project, 'out-wc');
  generate('web-components', 'web-components', '@ds-contracts/emitter-web-components', outDir);
  const elements = readdirSync(outDir).filter((f) => /^[a-z-]+\.ts$/.test(f) && !f.endsWith('.css.ts'));
  if (elements.length !== FLOWBITE_EIGHT.length) {
    cleanup();
    fail(`web-components: expected ${FLOWBITE_EIGHT.length} element modules, got ${elements.length} (${elements.join(', ')})`);
  }
  console.log(`  web-components: ${elements.length}/${FLOWBITE_EIGHT.length} elements from the @ds-contracts/emitter-web-components tarball`);
}

// 6. hermeticity — nothing in the temp project resolves back into this repo.
{
  const r = run('grep', ['-rl', ROOT, path.join(project, 'node_modules', '@ds-contracts')]);
  if (r.status === 0 && r.out.trim()) {
    cleanup();
    fail(`published bundles embed this repo's path:\n${r.out}`);
  }
}

cleanup();
console.log(
  `✔ verify:published — ${PACKAGES.map((p) => `@ds-contracts/${p}@${packed[`@ds-contracts/${p}`].version}`).join(', ')} packed, installed with no path back to the repo; a Vue emitter on @ds-contracts/core + @ds-contracts/schema alone and the web-components tarball both generated the Flowbite eight`,
);
