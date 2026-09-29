/**
 * The two Vite-only module features the playground's import engine uses,
 * resolved at BUILD time so `ds-contracts figma-to-react` runs the same engine
 * without Vite (playground/src/engine/data.ts is the only reachable user):
 *
 *   `import x from './file?raw'`         the file's text as a string, read the
 *                                        way Vite's raw loader reads it (UTF-8,
 *                                        nothing stripped)
 *   `import.meta.glob('<dir>/*<suffix>', { eager: true, import: 'default'
 *                     [, query: '?raw'] })`
 *                                        an object of static imports, in Vite's
 *                                        order (absolute paths, default string
 *                                        sort, dot files and node_modules
 *                                        skipped) under Vite's keys (the
 *                                        literal relative path as written)
 *
 * Anything else fails the build BY NAME rather than guessing at Vite's meaning:
 * a glob with any other option or pattern shape, `import.meta.glob` used as a
 * value, and `import.meta.env` / `import.meta.hot` in playground code (the
 * bundle has no Vite to answer them). packages/cli/test/vite-glob-plugin.test.ts
 * loads data.ts through Vite's ssrLoadModule AND through this plugin and
 * requires the same icons, contract order and token trees.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const RAW = '?raw';
const PLAYGROUND = `${path.sep}playground${path.sep}`;

class ViteFeatureError extends Error {
  constructor(code, file, source, node, detail) {
    const at = node ? `:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}` : '';
    super(`${code}: ${file}${at}: ${detail}`);
  }
}

/** Files one `<dir>/*<suffix>` pattern matches, in Vite's order. */
export function globFiles(importer, pattern) {
  const dir = path.resolve(path.dirname(importer), path.posix.dirname(pattern));
  const name = path.posix.basename(pattern);
  const star = name.indexOf('*');
  const prefix = name.slice(0, star), suffix = name.slice(star + 1);
  return readdirSync(dir)
    .filter((f) => !f.startsWith('.') && f.startsWith(prefix) && f.endsWith(suffix) && f.length >= prefix.length + suffix.length)
    .map((f) => path.join(dir, f))
    .filter((f) => statSync(f).isFile())
    .map((f) => f.split(path.sep).join('/'))
    .sort()
    .map((absolute) => {
      const relative = path.posix.relative(path.dirname(importer).split(path.sep).join('/'), absolute);
      return { absolute, key: relative.startsWith('./') || relative.startsWith('../') ? relative : `./${relative}` };
    });
}

function literal(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

/** Parse one `import.meta.glob(...)` call; refuses every form but the two above. */
function globCall(call, file, source) {
  const refuse = (detail) => { throw new ViteFeatureError('import-meta-glob-unsupported', file, source, call, detail); };
  if (call.typeArguments?.length) refuse('type arguments are not supported');
  if (call.arguments.length !== 2) refuse('expected exactly (pattern, { eager: true, import: "default" [, query: "?raw"] })');
  const [patternNode, optionsNode] = call.arguments;
  if (!ts.isStringLiteral(patternNode)) refuse('the pattern must be one string literal');
  const pattern = patternNode.text;
  if (!/^\.\.?\//.test(pattern)) refuse(`pattern ${JSON.stringify(pattern)} must be relative (./ or ../)`);
  const base = path.posix.basename(pattern), dir = path.posix.dirname(pattern);
  if (/[*?[\]{}()!]/.test(dir) || (base.match(/\*/g) ?? []).length !== 1 || /[?[\]{}()!]/.test(base))
    refuse(`pattern ${JSON.stringify(pattern)} must be <dir>/<prefix>*<suffix> (one * in the file name, nothing else)`);
  if (!ts.isObjectLiteralExpression(optionsNode)) refuse('the options must be an object literal');
  const options = {};
  for (const prop of optionsNode.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) refuse('options must be plain key: value pairs');
    const value = literal(prop.initializer);
    options[prop.name.text] = value;
  }
  const keys = Object.keys(options).sort().join(',');
  if (keys !== 'eager,import' && keys !== 'eager,import,query') refuse(`options {${keys}} are not supported`);
  if (options.eager !== true) refuse('eager must be true');
  if (options.import !== 'default') refuse('import must be "default"');
  if ('query' in options && options.query !== RAW) refuse('query must be "?raw"');
  return { pattern, query: options.query ?? '' };
}

/** A TS/JS source with its import.meta.glob calls replaced by static imports,
 *  or null when it has none. Throws by name on anything unsupported. */
export function transformGlobs(file, text) {
  const guarded = file.includes(PLAYGROUND);
  if (!text.includes('import.meta.glob') && !(guarded && /import\.meta\.(env|hot)\b/.test(text))) return null;
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const edits = [], imports = [];
  let index = 0;
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && ts.isMetaProperty(node.expression) && node.expression.keywordToken === ts.SyntaxKind.ImportKeyword) {
      const name = node.name.text;
      if (name === 'glob') {
        const call = node.parent;
        if (!call || !ts.isCallExpression(call) || call.expression !== node)
          throw new ViteFeatureError('import-meta-glob-unsupported', file, source, node, 'import.meta.glob is only supported as a direct call');
        const { pattern, query } = globCall(call, file, source);
        const props = globFiles(file, pattern).map(({ key }, i) => {
          const local = `__vite_glob_${index}_${i}`;
          imports.push(`import ${local} from ${JSON.stringify(key + query)};`);
          return `${JSON.stringify(key)}: ${local}`;
        });
        edits.push({ start: call.getStart(source), end: call.end, text: `({${props.join(', ')}})` });
        index++;
        return;
      }
      if (guarded && (name === 'env' || name === 'hot'))
        throw new ViteFeatureError('import-meta-vite-unsupported', file, source, node, `import.meta.${name} has no meaning outside Vite; the CLI bundle cannot answer it`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!edits.length) return null;
  let out = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return `${imports.join('\n')}\n${out}`;
}

export function viteGlobPlugin() {
  return {
    name: 'ds-contracts-vite-glob',
    setup(build) {
      // A file-namespace path with a ?raw suffix: the suffix keeps it a module of
      // its own, and esbuild names it by its relative path (never an absolute
      // path of the machine that built the bundle).
      build.onResolve({ filter: /\?raw$/ }, (args) => ({
        path: path.resolve(args.resolveDir, args.path.slice(0, -RAW.length)),
        suffix: RAW,
      }));
      build.onLoad({ filter: /.*/ }, (args) => {
        // Vite's raw loader: `export default ${JSON.stringify(readFile(file, 'utf-8'))}`.
        if (args.suffix === RAW) return { contents: `export default ${JSON.stringify(readFileSync(args.path, 'utf8'))};\n`, loader: 'js' };
        if (!/\.[cm]?[jt]sx?$/.test(args.path) || args.path.includes(`${path.sep}node_modules${path.sep}`)) return undefined;
        const text = readFileSync(args.path, 'utf8');
        const contents = transformGlobs(args.path, text);
        if (contents === null) return undefined;
        const ext = path.extname(args.path).replace(/^\.[cm]?/, '.');
        return { contents, loader: ext.slice(1), resolveDir: path.dirname(args.path) };
      });
    },
  };
}
