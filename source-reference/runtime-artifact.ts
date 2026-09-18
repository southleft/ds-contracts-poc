/** Node-only preparation of an explicitly trusted original runtime dependency.
 * Not a contract generator. Mutable canvas metadata never authorizes this API. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  lstatSync,
  realpathSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import {
  readCemDeclarations,
  type CemDeclarationFacts,
} from "../extract/adapters/cem.js";
import { revisionOf } from "../core/contract-provenance.js";

export interface RuntimeFileDigest {
  path: string;
  bytes: number;
  sha256: string;
}
export interface RuntimeInputManifest {
  version: 1;
  adapter: "altitude-button-v1" | "altitude-checkbox-v1";
  sourceRevision: string;
  files: Array<
    RuntimeFileDigest & { kind: "source" | "dependency" | "config-discovery" }
  >;
  packages: Array<{
    path: string;
    name: string;
    version: string;
    dependencies: Array<{ name: string; path: string | null }>;
  }>;
  tools: { vite: string; sass: string; typescript: string; nodeTypes?: string };
  inputRevision: string;
}
export interface RuntimeProperty {
  name: string;
  typeText: string;
  sourcePath: string;
  declaringClass: string;
  writable: boolean;
  reason: "lit-property" | "computed-query" | "public-ref-member";
}
/** Generic data seam. Hosts resolve bytes and trust; the existing core emitter
 * only consumes these declared identities, never executes their metadata. */
export interface RuntimeArtifactInterface {
  version: 1;
  module: { path: string; exportName: string };
  declaration: { path: string; exportName: string };
  tagBase: string;
  writableProperties: string[];
  properties: RuntimeProperty[];
  slots: CemDeclarationFacts["slots"];
  events: CemDeclarationFacts["events"];
  originalDeclarations: CemDeclarationFacts[];
  typeDependencies: Array<{ name: string; version: string }>;
  peerRuntime: { name: "react"; major: 19; mounting: "direct-custom-element" };
}
export interface RuntimeArtifactManifest {
  version: 1;
  kind: "original-custom-element-runtime";
  adapter: string;
  source: { revision: string; inputRevision: string; baselineSha256: string };
  recipe: {
    version: string;
    sha256: string;
    node: string;
    conditions: string[];
    repeatedBuildIdentical: true;
  };
  interface: RuntimeArtifactInterface;
  interfaceRevision: string;
  inputs: RuntimeInputManifest;
  consumedInputs: string[];
  stylesheetInputs: string[];
  files: Array<
    RuntimeFileDigest & { kind: "module" | "stylesheet" | "declaration" }
  >;
  limitations: string[];
}
export interface VerifiedRuntimeArtifact {
  artifactRevision: string;
  interfaceRevision: string;
  manifest: RuntimeArtifactManifest;
  files: Map<string, Buffer>;
  /** Content-bound, valid custom-element name; no registration is performed. */
  registrationTag: string;
}
export interface RuntimeSourceApproval {
  kind: "local-source-build";
  checkout: string;
  sourceRevision: string;
  inputRevision: string;
  /** Owner-approved recorded baseline, rechecked before execution. */
  baseline: { path: string; sha256: string };
}
export interface PrepareAltitudeRuntimeRequest {
  checkout: string;
  expectedInputManifest: RuntimeInputManifest;
  sourceApproval: RuntimeSourceApproval;
  /** Existing, private, host-owned directory. Never the source checkout. */
  outputRoot: string;
}

export type AltitudeRuntimeComponent = "button" | "checkbox";
function runtimeTarget(component: AltitudeRuntimeComponent) {
  if (component !== "button" && component !== "checkbox")
    refusal("component-unsupported");
  return {
    component,
    className: component === "button" ? "ALButton" : "ALCheckbox",
    tagName: `al-${component}`,
    modulePath: `components/${component}/${component}.ts`,
    declarationPath: `components/${component}/${component}.d.ts`,
    adapter: `altitude-${component}-v1` as const,
  };
}

const LIBRARY = "libs/al-web-components";
const PINNED = "0639eccd15bfedc4fa9713d9545a64cef2c0f0a5";
const HASH = /^[a-f0-9]{64}$/;
const REVISION = /^sha256:[a-f0-9]{64}$/;
const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const encode = (value: unknown) => JSON.stringify(value);
const refusal = (code: string): never => {
  throw Error(`runtime-artifact-${code}`);
};
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const relativePath = (value: unknown): value is string =>
  typeof value === "string" &&
  !!value &&
  !path.isAbsolute(value) &&
  !/[\\\0?#:]/.test(value) &&
  value.split("/").every((part) => part && part !== "." && part !== "..");
const inside = (root: string, file: string) =>
  file === root || file.startsWith(root + path.sep);
function regularRead(root: string, relative: string): Buffer {
  if (!relativePath(relative)) refusal("path-invalid");
  let current = root;
  if (!lstatSync(root).isDirectory()) refusal("root-invalid");
  for (const [index, part] of relative.split("/").entries()) {
    current = path.join(current, part);
    const stat = lstatSync(current);
    if (
      stat.isSymbolicLink() ||
      (index === relative.split("/").length - 1
        ? !stat.isFile()
        : !stat.isDirectory())
    )
      refusal("symlink-or-kind-invalid");
    if (stat.isFile() && stat.size > 128 * 1024 * 1024)
      refusal("file-size-limit");
  }
  return readFileSync(current);
}
function digestFile(root: string, file: string): RuntimeFileDigest {
  const bytes = regularRead(root, file);
  return { path: file, bytes: bytes.length, sha256: sha(bytes) };
}
function canonicalDirectory(directory: string): string {
  if (!path.isAbsolute(directory) || !lstatSync(directory).isDirectory())
    refusal("directory-invalid");
  const resolved = realpathSync(directory);
  // Permit only the fixed macOS OS aliases, not arbitrary ancestor links that
  // could redirect an approved source or private output directory.
  const normalized = path.resolve(directory);
  const platformPath =
    process.platform === "darwin"
      ? normalized
          .replace(/^\/var(?=\/|$)/, "/private/var")
          .replace(/^\/tmp(?=\/|$)/, "/private/tmp")
      : normalized;
  if (resolved !== platformPath) refusal("directory-symlink");
  return resolved;
}
function packageRoot(
  checkout: string,
  from: string,
  name: string,
): string | null {
  if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name))
    refusal("dependency-name-invalid");
  let dir = from;
  while (inside(checkout, dir)) {
    const candidate = path.join(dir, "node_modules", name);
    try {
      const resolved = realpathSync(candidate);
      if (
        !inside(path.join(checkout, "node_modules"), resolved) ||
        !lstatSync(resolved).isDirectory()
      )
        refusal("dependency-outside-checkout");
      regularRead(resolved, "package.json");
      return resolved;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (dir === checkout) break;
    dir = path.dirname(dir);
  }
  return null;
}

/** Read-only preflight. A digest is identity, not permission to execute it. */
export function inspectAltitudeButtonRuntimeInputs(
  checkoutPath: string,
): RuntimeInputManifest {
  return inspectAltitudeRuntimeInputs(checkoutPath, "button");
}
export function inspectAltitudeRuntimeInputs(
  checkoutPath: string,
  component: AltitudeRuntimeComponent,
): RuntimeInputManifest {
  const target = runtimeTarget(component);
  const checkout = canonicalDirectory(checkoutPath);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", checkout, ...args], {
      maxBuffer: 16 * 1024 * 1024,
    });
  const revision = git("rev-parse", "HEAD").toString().trim();
  if (revision !== PINNED || git("diff", "HEAD", "--name-only").length)
    refusal("source-revision-or-dirty");
  const files: RuntimeInputManifest["files"] = [];
  const tracked = new Set<string>();
  for (const entry of git("ls-tree", "-rz", "--full-tree", "HEAD")
    .toString()
    .split("\0")
    .filter(Boolean)) {
    const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(entry);
    if (!match) continue;
    const file = match[3];
    if (!(
      file.startsWith(LIBRARY + "/") ||
      ["pnpm-lock.yaml", "package.json"].includes(file)
    ))
      continue;
    if (/(?:^|\/)\.env(?:\.|$)/.test(file)) refusal("environment-file-refused");
    if (match[1] === "120000") refusal("source-symlink");
    const bytes = regularRead(checkout, file);
    const blob = createHash("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex");
    if (blob !== match[2]) refusal("source-bytes-changed");
    tracked.add(file);
    files.push({
      path: file,
      kind: "source",
      bytes: bytes.length,
      sha256: sha(bytes),
    });
  }
  // The original config discovers entry candidates even though this build then
  // narrows its entry set. Current discovery-only inputs are explicitly approved
  // by digest, but are never represented as historical or runtime source inputs.
  const components = path.join(checkout, LIBRARY, "components");
  for (const item of readdirSync(components, { withFileTypes: true })) {
    if (item.name.startsWith(".")) continue;
    if (item.isSymbolicLink()) refusal("source-discovery-symlink");
    if (!item.isDirectory()) continue;
    const candidate = `${LIBRARY}/components/${item.name}/${item.name}.ts`;
    try {
      regularRead(checkout, candidate);
      if (!tracked.has(candidate))
        files.push({
          ...digestFile(checkout, candidate),
          kind: "config-discovery",
        });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const item of readdirSync(path.join(components, "icon/icons"), {
    withFileTypes: true,
  })) {
    if (item.isSymbolicLink()) refusal("source-discovery-symlink");
    if (
      item.isFile() &&
      item.name.endsWith(".ts") &&
      !tracked.has(`${LIBRARY}/components/icon/icons/${item.name}`)
    )
      files.push({
        ...digestFile(
          checkout,
          `${LIBRARY}/components/icon/icons/${item.name}`,
        ),
        kind: "config-discovery",
      });
  }
  for (const file of [`${LIBRARY}/styles/dist/scss/theme/tokens-dark.scss`]) {
    if (!tracked.has(file))
      files.push({ ...digestFile(checkout, file), kind: "source" });
  }
  const lock = parseYaml(regularRead(checkout, "pnpm-lock.yaml").toString());
  if (!object(lock) || !object(lock.packages)) refusal("lock-invalid");
  const packages: RuntimeInputManifest["packages"] = [];
  const roots = new Map<string, string>();
  for (const name of [
    "vite",
    "sass",
    "typescript",
    "lit",
    "lit-html",
    ...(component === "checkbox" ? ["nanoid"] : []),
  ]) {
    const found = packageRoot(checkout, path.join(checkout, LIBRARY), name);
    if (!found) refusal("dependency-missing");
    roots.set(name, found!);
  }
  // The source registry uses process.env. Restrict ambient types to Vite's
  // lock-verified Node types; their buffer import can resolve a real package.
  const nodeTypes =
    component === "checkbox"
      ? packageRoot(checkout, roots.get("vite")!, "@types/node")
      : null;
  if (component === "checkbox") {
    if (!nodeTypes) refusal("node-types-unrecorded");
    roots.set("nodeTypes", nodeTypes!);
    const bufferTypes = packageRoot(checkout, nodeTypes!, "buffer");
    if (bufferTypes) roots.set("bufferTypes", bufferTypes);
  }
  const queue = [...roots.values()],
    seen = new Set<string>();
  let total = 0;
  while (queue.length) {
    const root = queue.shift()!;
    if (seen.has(root)) continue;
    seen.add(root);
    if (seen.size > 256) refusal("dependency-count-limit");
    const pkg = JSON.parse(regularRead(root, "package.json").toString());
    if (
      !object(pkg) ||
      typeof pkg.name !== "string" ||
      typeof pkg.version !== "string" ||
      !object(lock.packages[`${pkg.name}@${pkg.version}`])
    )
      refusal("dependency-not-in-lock");
    const dependencies: Array<{ name: string; path: string | null }> = [];
    const optional = object(pkg.optionalDependencies)
      ? pkg.optionalDependencies
      : {};
    const peers = object(pkg.peerDependencies) ? pkg.peerDependencies : {};
    const required = object(pkg.dependencies) ? pkg.dependencies : {};
    for (const name of [
      ...new Set([
        ...Object.keys(required),
        ...Object.keys(optional),
        ...Object.keys(peers),
      ]),
    ].sort()) {
      const found = packageRoot(checkout, root, name);
      const optionalPeer =
        object(pkg.peerDependenciesMeta) &&
        object(pkg.peerDependenciesMeta[name]) &&
        pkg.peerDependenciesMeta[name].optional === true;
      if (!found && !(name in optional) && !(name in peers && optionalPeer))
        refusal("dependency-missing");
      dependencies.push({
        name,
        path: found ? path.relative(checkout, found) : null,
      });
      if (found) queue.push(found);
    }
    const walk = (dir: string) => {
      for (const item of readdirSync(dir, { withFileTypes: true }).sort(
        (a, b) => a.name.localeCompare(b.name),
      )) {
        if (item.name === "node_modules") continue;
        const file = path.join(dir, item.name);
        if (item.isSymbolicLink()) refusal("dependency-file-symlink");
        if (item.isDirectory()) walk(file);
        else if (item.isFile()) {
          if (/(?:^|\/)\.env(?:\.|$)/.test(file))
            refusal("environment-file-refused");
          const row = digestFile(checkout, path.relative(checkout, file));
          total += row.bytes;
          if (total > 512 * 1024 * 1024 || files.length > 30000)
            refusal("dependency-byte-limit");
          files.push({ ...row, kind: "dependency" });
        } else refusal("dependency-file-kind");
      }
    };
    walk(root);
    packages.push({
      path: path.relative(checkout, root),
      name: pkg.name,
      version: pkg.version,
      dependencies,
    });
  }
  const body: Omit<RuntimeInputManifest, "inputRevision"> = {
    version: 1,
    adapter: target.adapter,
    sourceRevision: revision,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    packages: packages.sort((a, b) => a.path.localeCompare(b.path)),
    tools: {
      vite: path.relative(checkout, roots.get("vite")!),
      sass: path.relative(checkout, roots.get("sass")!),
      typescript: path.relative(checkout, roots.get("typescript")!),
      ...(nodeTypes ? { nodeTypes: path.relative(checkout, nodeTypes) } : {}),
    },
  };
  return { ...body, inputRevision: sha(encode(body)) };
}

/** Trusted package code, kept separate so collision refusal is tested without
 * needing the private source checkout. Uses the source constructor and version. */
export const ALTITUDE_CHECKBOX_REGISTRATION_GUARD = String.raw`
const suffix = PackageJson.version.replace(/[\W_]/g, "-");
const childTag = ALFieldNote.el + (suffix ? "-" + suffix : "");
const existing = customElements.get(childTag);
if (existing && existing !== ALFieldNote) throw new Error("RUNTIME-ARTIFACT-NESTED-REGISTRY-COLLISION");
if (!existing) customElements.define(childTag, ALFieldNote);
`;

// Executed in a fresh process only AFTER the entire local input inventory has
// been approved. No source build script, env file, install, network fetch, cache
// write, public asset copy or default output directory is invoked.
function buildRecipe(component: AltitudeRuntimeComponent) {
  const target = runtimeTarget(component);
  return String.raw`
import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const input=JSON.parse(readFileSync(0,'utf8')),root=input.checkout,lib=path.join(root,'libs/al-web-components');
const load=async file=>(await import(pathToFileURL(file).href));
const vite=await load(path.join(root,input.tools.vite,'dist/node/index.js'));
const sass=(await load(path.join(root,input.tools.sass,'sass.node.js'))).default;
const ts=(await load(path.join(root,input.tools.typescript,'lib/typescript.js'))).default;
const config=(await load(path.join(lib,'vite.config.mjs'))).default;
const warnings=[],logger={hasWarned:false,info(){},clearScreen(){},hasErrorLogged(){return false},warn(m){warnings.push(String(m))},warnOnce(m){this.warn(m)},error(m){warnings.push(String(m))}};
const entry='runtime-original-entry',guard='runtime-registration-guard';
const guardPlugin={name:'trusted-original-runtime-guard',resolveId(id){if([entry,guard].includes(id))return String.fromCharCode(0)+id},load(id){
 if(id===String.fromCharCode(0)+guard)return 'export const admitted = (() => { if (globalThis.alAutoRegistry === true) throw new Error("RUNTIME-ARTIFACT-AUTO-REGISTRY-REFUSED"); return true; })();';
${component === "button" ? String.raw` if(id===String.fromCharCode(0)+entry)return 'import {admitted} from '+JSON.stringify(guard)+'; import {${target.className}} from '+JSON.stringify(path.join(lib,'components/${component}/${component}.ts'))+'; if (!admitted) throw new Error("RUNTIME-ARTIFACT-IMPORT-REFUSED"); export {${target.className}};';` : String.raw` if(id===String.fromCharCode(0)+entry)return 'import {admitted} from '+JSON.stringify(guard)+'; import {ALCheckbox} from '+JSON.stringify(path.join(lib,'components/checkbox/checkbox.ts'))+'; import {ALFieldNote} from '+JSON.stringify(path.join(lib,'components/field-note/field-note.ts'))+'; import PackageJson from '+JSON.stringify(path.join(lib,'package.json'))+'; if (!admitted) throw new Error("RUNTIME-ARTIFACT-IMPORT-REFUSED"); ' + ${JSON.stringify(ALTITUDE_CHECKBOX_REGISTRATION_GUARD)} + ' export {ALCheckbox};';`}
}};
const options={...config,configFile:false,envFile:false,root:lib,mode:'production',customLogger:logger,
 plugins:[...config.plugins,guardPlugin],
 css:{...config.css,postcss:{plugins:[]}},
 resolve:{conditions:['browser','module','production'],mainFields:['browser','module','jsnext:main','jsnext']},
 build:{...config.build,write:false,emptyOutDir:false,copyPublicDir:false,sourcemap:false,
 rollupOptions:{...config.build.rollupOptions,external:[],input:{${component}:entry,theme:path.join(lib,'styles/theme.ts')}}}};
const rows=result=>(Array.isArray(result)?result.flatMap(x=>x.output):result.output).map(x=>({path:x.fileName,body:Buffer.from(x.code??x.source).toString('base64'),kind:x.type==='chunk'?'module':'stylesheet',imports:x.type==='chunk'?[...x.imports,...x.dynamicImports]:[],exports:x.type==='chunk'?x.exports:[],modules:x.type==='chunk'?Object.keys(x.modules).filter(p=>p.charCodeAt(0)!==0).map(p=>realpathSync(p.split('?')[0])):[]})).sort((a,b)=>a.path.localeCompare(b.path));
const outputs=rows(await vite.build(options));assert.deepEqual(rows(await vite.build(options)),outputs);assert.deepEqual(warnings,[]);
const stylePaths=new Set();
for(const file of ['components/${component}/${component}.scss',${component === "checkbox" ? "'components/field-note/field-note.scss'," : ""}'styles/shadow-utilities.scss','styles/main.scss']){
 const result=sass.compile(path.join(lib,file),{logger:{warn(){}}});
 for(const url of result.loadedUrls){assert.equal(url.protocol,'file:');stylePaths.add(realpathSync(fileURLToPath(url)))}
}
const raw=ts.readConfigFile(path.join(lib,'tsconfig.json'),ts.sys.readFile);assert.equal(raw.error,undefined);
const parsed=ts.parseJsonConfigFileContent(raw.config,ts.sys,lib);assert.equal(parsed.errors.length,0);
const compilerOptions={...parsed.options,moduleResolution:ts.ModuleResolutionKind.Bundler,types:${component === "button" ? "[]" : "['node'],typeRoots:[path.dirname(path.join(root,input.tools.nodeTypes))]"},declaration:true,declarationMap:false,emitDeclarationOnly:true,noEmitOnError:true};
const host=ts.createCompilerHost(compilerOptions),declarations=[];
host.writeFile=(file,text)=>{const relative=path.relative(path.join(lib,'dist'),file);assert.ok(!relative.startsWith('..')&&!path.isAbsolute(relative));declarations.push({path:relative,body:Buffer.from(text).toString('base64'),kind:'declaration'})};
const program=ts.createProgram(['components/${component}/${component}.ts','global.d.ts'].map(file=>path.join(lib,file)),compilerOptions,host);
assert.deepEqual(ts.getPreEmitDiagnostics(program).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[]);
${component === "button" ? "assert.equal(program.emit().emitSkipped,false);" : "// JSON inputs have no declaration output; TypeScript marks their declaration-only emit skipped. Every actual TS implementation must emit with zero diagnostics.\nfor(const file of program.getSourceFiles().filter(file=>!file.isDeclarationFile&&!ts.isJsonSourceFile(file))){const emitted=program.emit(file);assert.deepEqual(emitted.diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\\n')),[]);assert.equal(emitted.emitSkipped,false);}"}
const checker=program.getTypeChecker(),properties=[];
for(const [file,className] of [['components/${component}/${component}.ts','${target.className}'],['components/ALElement.ts','ALElement']]){
 const sf=program.getSourceFile(path.join(lib,file));assert.ok(sf);
 const cls=sf.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text===className);assert.ok(cls);
 const declared=declarations.find(row=>row.path===file.replace(/\.ts$/,'.d.ts'));assert.ok(declared);
 const dsf=ts.createSourceFile(declared.path,Buffer.from(declared.body,'base64').toString(),ts.ScriptTarget.Latest,true);
 const dcls=dsf.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text===className);assert.ok(dcls);
 for(const member of cls.members){
  const modifiers=ts.canHaveModifiers(member)?ts.getModifiers(member)??[]:[];
  if(modifiers.some(m=>[ts.SyntaxKind.PrivateKeyword,ts.SyntaxKind.ProtectedKeyword,ts.SyntaxKind.StaticKeyword].includes(m.kind))||!member.name||!ts.isIdentifier(member.name))continue;
  const decorators=ts.canHaveDecorators(member)?ts.getDecorators(member)??[]:[];
  const names=decorators.map(d=>ts.isCallExpression(d.expression)&&ts.isIdentifier(d.expression.expression)?d.expression.expression.text:'unsupported');
  if(names.some(name=>!['property','queryAssignedNodes'].includes(name)))throw Error('unsupported source decorator');
  const symbol=checker.getSymbolAtLocation(member.name);assert.ok(symbol);
  const dmember=dcls.members.find(node=>node.name&&ts.isIdentifier(node.name)&&node.name.text===member.name.text);assert.ok(dmember);
  // Fresh declaration syntax keeps inferred package types portable; checker
  // diagnostic strings can contain absolute pnpm checkout paths.
  const typeText=(ts.isMethodDeclaration(member)?dmember:dmember.type??dmember).getText(dsf);
  properties.push({name:member.name.text,typeText,sourcePath:'libs/al-web-components/'+file,declaringClass:className,writable:names.includes('property')&&!modifiers.some(m=>m.kind===ts.SyntaxKind.ReadonlyKeyword),reason:names.includes('property')?'lit-property':names.includes('queryAssignedNodes')?'computed-query':'public-ref-member'});
 }
}
const consumed=[...new Set([...outputs.flatMap(row=>row.modules),...program.getSourceFiles().map(file=>realpathSync(file.fileName))])].sort();
console.log(JSON.stringify({outputs:outputs.map(({modules,...row})=>row),declarations,consumed,styles:[...stylePaths].sort(),properties,versions:{vite:vite.version,typescript:ts.version}}));
`;
}
const BUILD_RECIPE = buildRecipe("button");

interface BuildOutput {
  outputs: Array<{
    path: string;
    body: string;
    kind: "module" | "stylesheet";
    imports: string[];
    exports: string[];
  }>;
  declarations: Array<{ path: string; body: string; kind: "declaration" }>;
  consumed: string[];
  styles: string[];
  properties: RuntimeProperty[];
  versions: { vite: string; typescript: string };
}

function validateApproval(
  request: PrepareAltitudeRuntimeRequest,
  checkout: string,
  component: AltitudeRuntimeComponent = "button",
) {
  const target = runtimeTarget(component);
  const expected = request.expectedInputManifest,
    approval = request.sourceApproval;
  if (
    !expected ||
    expected.adapter !== target.adapter ||
    !approval ||
    approval.kind !== "local-source-build" ||
    approval.checkout !== checkout ||
    approval.sourceRevision !== expected.sourceRevision ||
    approval.inputRevision !== expected.inputRevision ||
    !HASH.test(approval.baseline?.sha256 ?? "")
  )
    refusal("approval-required");
  const file = approval.baseline.path;
  if (
    typeof file !== "string" ||
    !path.isAbsolute(file) ||
    path.basename(file) !== "measurement.json"
  )
    refusal("baseline-invalid");
  const baselineRoot = canonicalDirectory(path.dirname(file));
  const bytes = regularRead(baselineRoot, path.basename(file));
  if (sha(bytes) !== approval.baseline.sha256) refusal("baseline-changed");
  const baseline = JSON.parse(bytes.toString());
  if (
    !object(baseline) ||
    baseline.sourceRevision !== expected.sourceRevision ||
    baseline.sourceStable !== true ||
    !object(baseline.sourceHashes) ||
    !Array.isArray(baseline.rows)
  )
    refusal("baseline-invalid");
  const rows = baseline.rows.filter(
    (row: unknown) =>
      object(row) && row.story === `atoms-${component}--default`,
  );
  if (rows.length !== 1 || rows[0].qualified !== true)
    refusal("baseline-original-refused");
  const row = rows[0];
  if (
    !object(row.source) ||
    !object(row.replay) ||
    row.source.status !== "valid" ||
    row.replay.status !== "valid" ||
    typeof row.source.sha256 !== "string" ||
    !HASH.test(row.source.sha256) ||
    row.replay.sha256 !== row.source.sha256
  )
    refusal("baseline-images-invalid");
  for (const name of ["source", "replay"]) {
    if (
      sha(
        regularRead(baselineRoot, `atoms-${component}--default/${name}.png`),
      ) !== row.source.sha256
    )
      refusal("baseline-image-changed");
  }
  for (const input of expected.files) {
    if (
      input.kind === "source" &&
      (input.path.startsWith(LIBRARY + "/") ||
        input.path === "pnpm-lock.yaml") &&
      baseline.sourceHashes[input.path] !== input.sha256
    )
      refusal("baseline-source-mismatch");
  }
}

/** Read-only identity of the fixed trusted recipe, not source execution or an
 * authorization token. Used when reopening an application-owned preparation. */
export function altitudeButtonRuntimeRecipeIdentity() {
  return altitudeRuntimeRecipeIdentity("button");
}
export function altitudeRuntimeRecipeIdentity(
  component: AltitudeRuntimeComponent,
) {
  return {
    version:
      component === "button"
        ? "altitude-vite-memory-v1"
        : "altitude-checkbox-vite-memory-v1",
    sha256: sha(component === "button" ? BUILD_RECIPE : buildRecipe(component)),
    conditions: ["browser", "module", "production"],
  };
}

/** Fresh original-library build. The returned bytes remain private and are not
 * approved for conversion merely because their package identity validates. */
export function prepareAltitudeButtonRuntime(
  request: PrepareAltitudeRuntimeRequest,
): VerifiedRuntimeArtifact {
  return prepareAltitudeRuntime(request, "button");
}
export function prepareAltitudeRuntime(
  request: PrepareAltitudeRuntimeRequest,
  component: AltitudeRuntimeComponent,
): VerifiedRuntimeArtifact {
  const target = runtimeTarget(component);
  const recipe = altitudeRuntimeRecipeIdentity(component);
  const checkout = canonicalDirectory(request.checkout);
  validateApproval(request, checkout, component);
  const before = inspectAltitudeRuntimeInputs(checkout, component);
  if (encode(before) !== encode(request.expectedInputManifest))
    refusal("inputs-changed");
  const outputRoot = canonicalDirectory(request.outputRoot);
  if (inside(checkout, outputRoot) || inside(outputRoot, checkout))
    refusal("output-overlaps-source");
  const build = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        component === "button" ? BUILD_RECIPE : buildRecipe(component),
      ],
      {
        cwd: checkout,
        input: encode({ checkout, tools: before.tools }),
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 120000,
        // No inherited NODE_OPTIONS, VITE_* values, proxy credentials or env files.
        env: {
          PATH: process.env.PATH ?? "/usr/bin:/bin",
          NODE_ENV: "production",
        },
      },
    ),
  ) as BuildOutput;
  if (
    encode(inspectAltitudeRuntimeInputs(checkout, component)) !== encode(before)
  )
    refusal("inputs-changed-during-build");
  validateApproval(request, checkout, component);
  const known = new Map(before.files.map((file) => [file.path, file]));
  const consumed = (paths: string[]) =>
    paths
      .map((file) => {
        const relative = path.relative(checkout, file);
        if (
          !relativePath(relative) ||
          !known.has(relative) ||
          known.get(relative)!.kind === "config-discovery" ||
          relative.includes(`${LIBRARY}/dist/`)
        )
          refusal("unrecorded-build-input");
        return relative;
      })
      .sort();
  const consumedInputs = consumed(build.consumed),
    stylesheetInputs = consumed(build.styles);
  const files = new Map<string, Buffer>();
  const rows: RuntimeArtifactManifest["files"] = [];
  for (const output of [...build.outputs, ...build.declarations].sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    if (
      !relativePath(output.path) ||
      files.has(output.path) ||
      output.path === "manifest.json"
    )
      refusal("output-path-invalid");
    const bytes = Buffer.from(output.body, "base64");
    if (bytes.toString("base64") !== output.body)
      refusal("output-encoding-invalid");
    files.set(output.path, bytes);
    rows.push({
      path: output.path,
      kind: output.kind,
      bytes: bytes.length,
      sha256: sha(bytes),
    });
  }
  for (const output of build.outputs)
    for (const imported of output.imports) {
      if (!files.has(imported)) refusal("external-runtime-dependency");
    }
  const entry = build.outputs.filter((output) =>
    output.exports.includes(target.className),
  );
  if (entry.length !== 1 || !files.has(target.declarationPath))
    refusal("entry-missing");
  const rawCem = JSON.parse(
    regularRead(checkout, `${LIBRARY}/custom-elements.json`).toString(),
  );
  if (!object(rawCem) || !Array.isArray(rawCem.modules))
    refusal("cem-identity-invalid");
  const cem = readCemDeclarations({
    ...rawCem,
    modules: rawCem.modules.filter(
      (module: unknown) => object(module) && module.path === target.modulePath,
    ),
  });
  if (cem.problems.length) refusal("cem-declaration-invalid");
  const declarations = cem.declarations.filter((declaration) =>
    [target.className, "ALElement"].includes(declaration.className),
  );
  const rootDeclarations = declarations.filter(
    (declaration) => declaration.className === target.className,
  );
  if (
    rootDeclarations.length !== 1 ||
    rootDeclarations[0].modulePath !== target.modulePath ||
    rootDeclarations[0].tagName !== target.tagName
  )
    refusal("cem-identity-invalid");
  // Derived-class members precede base members in the compiler inventory.
  // Preserve normal override semantics rather than flattening two identities.
  const properties = [
    ...new Map(
      build.properties.map((property) => [
        property.name,
        build.properties.find((candidate) => candidate.name === property.name)!,
      ]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const iface: RuntimeArtifactInterface = {
    version: 1,
    module: { path: entry[0].path, exportName: target.className },
    declaration: {
      path: target.declarationPath,
      exportName: target.className,
    },
    tagBase: rootDeclarations[0].tagName,
    writableProperties: properties
      .filter((property) => property.writable)
      .map((property) => property.name),
    properties,
    slots: rootDeclarations[0].slots,
    events: rootDeclarations[0].events,
    originalDeclarations: declarations,
    typeDependencies: before.packages
      .filter(
        (pkg) =>
          pkg.name !== "typescript" &&
          consumedInputs.some(
            (file) =>
              file.startsWith(pkg.path + "/") && /\.d\.[cm]?ts$/.test(file),
          ),
      )
      .map(({ name, version }) => ({ name, version }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    peerRuntime: {
      name: "react",
      major: 19,
      mounting: "direct-custom-element",
    },
  };
  const manifest: RuntimeArtifactManifest = {
    version: 1,
    kind: "original-custom-element-runtime",
    adapter: before.adapter,
    source: {
      revision: before.sourceRevision,
      inputRevision: before.inputRevision,
      baselineSha256: request.sourceApproval.baseline.sha256,
    },
    recipe: {
      version: recipe.version,
      sha256: recipe.sha256,
      node: process.version,
      conditions: recipe.conditions,
      repeatedBuildIdentical: true,
    },
    interface: iface,
    interfaceRevision: revisionOf(iface),
    inputs: before,
    consumedInputs,
    stylesheetInputs,
    files: rows,
    limitations: [
      "Private original runtime artifact, not accepted contract, source fidelity, Figma qualification or redistribution permission.",
      "React 19 direct custom-element mounting is required. Existing @lit/react wrapper initialization is not substituted.",
      "A used first-dependency guard refuses alAutoRegistry=true before original class evaluation; original source is unmodified. Consumer registration must also refuse constructor/tag collisions.",
      ...(component === "checkbox"
        ? [
            "Before export, the Checkbox package reserves the original versioned FieldNote tag with its original constructor and refuses a different existing constructor. Keep alAutoRegistry unset or false for the lifetime of this package; changing that global after import is unsupported.",
            "Checkbox declaration emission requires the recorded Node ambient types with restricted type roots. JSON inputs remain recorded but have no declaration output; every TypeScript implementation must emit without diagnostics.",
          ]
        : []),
      "Fresh original declarations use Bundler module resolution against pinned package exports, not the source config's legacy Node resolution; no declaration strings are rewritten. Listed type dependencies are required.",
      "The original theme CSS still references external fonts. Approved recorded font assets and readiness validation are required; no font is fetched here.",
      "Styling edits are not qualified by this artifact; exact source projection must remain fixed until explicit supported style hooks are verified.",
      "Input inventories are rechecked before/after build, not a continuous mutation monitor or sandbox for malicious trusted code.",
    ],
  };
  const manifestBytes = Buffer.from(encode(manifest) + "\n"),
    artifactRevision = "sha256:" + sha(manifestBytes);
  const destination = path.join(outputRoot, artifactRevision.slice(7));
  try {
    lstatSync(destination);
    return readVerifiedRuntimeArtifact(destination, artifactRevision);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  mkdirSync(destination, { mode: 0o700 });
  for (const [file, bytes] of files) {
    regularParents(destination, file);
    writeFileSync(path.join(destination, file), bytes, {
      flag: "wx",
      mode: 0o600,
    });
  }
  writeFileSync(path.join(destination, "manifest.json"), manifestBytes, {
    flag: "wx",
    mode: 0o600,
  });
  return readVerifiedRuntimeArtifact(destination, artifactRevision);
}

function regularParents(root: string, file: string) {
  if (!relativePath(file)) refusal("path-invalid");
  let dir = root;
  if (!lstatSync(root).isDirectory()) refusal("root-invalid");
  for (const part of file.split("/").slice(0, -1)) {
    dir = path.join(dir, part);
    try {
      if (!lstatSync(dir).isDirectory()) refusal("output-symlink-or-kind");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      mkdirSync(dir, { mode: 0o700 });
      if (!lstatSync(dir).isDirectory()) refusal("output-symlink-or-kind");
    }
  }
}

/** Only reopens already prepared bytes. No imports, builds, metadata execution,
 * missing-file repair or source discovery occur at this boundary. */
export function readVerifiedRuntimeArtifact(
  directory: string,
  expectedArtifactRevision: string,
): VerifiedRuntimeArtifact {
  if (!REVISION.test(expectedArtifactRevision))
    refusal("expected-revision-invalid");
  const root = canonicalDirectory(directory);
  const bytes = regularRead(root, "manifest.json");
  if ("sha256:" + sha(bytes) !== expectedArtifactRevision)
    refusal("manifest-hash-mismatch");
  const manifest = JSON.parse(bytes.toString()) as RuntimeArtifactManifest;
  if (
    !object(manifest) ||
    manifest.version !== 1 ||
    manifest.kind !== "original-custom-element-runtime" ||
    !object(manifest.interface) ||
    !REVISION.test(manifest.interfaceRevision) ||
    revisionOf(manifest.interface) !== manifest.interfaceRevision ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length
  )
    refusal("manifest-invalid");
  const iface = manifest.interface;
  if (
    iface.version !== 1 ||
    !object(iface.module) ||
    !object(iface.declaration) ||
    !relativePath(iface.module.path) ||
    !relativePath(iface.declaration.path) ||
    !/\.[cm]?js$/.test(iface.module.path) ||
    iface.declaration.path !==
      iface.module.path.replace(/\.([cm]?)js$/, ".d.$1ts") ||
    !/^[A-Za-z_$][\w$]*$/.test(iface.module.exportName) ||
    !/^[A-Za-z_$][\w$]*$/.test(iface.declaration.exportName) ||
    !/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(iface.tagBase) ||
    !Array.isArray(iface.writableProperties) ||
    new Set(iface.writableProperties).size !==
      iface.writableProperties.length ||
    iface.writableProperties.some(
      (name) => typeof name !== "string" || !/^[A-Za-z_$][\w$]*$/.test(name),
    )
  )
    refusal("interface-invalid");
  if (
    !Array.isArray(iface.properties) ||
    iface.properties.some(
      (property) =>
        !object(property) ||
        typeof property.name !== "string" ||
        typeof property.typeText !== "string" ||
        !property.typeText ||
        !relativePath(property.sourcePath) ||
        typeof property.declaringClass !== "string" ||
        typeof property.writable !== "boolean" ||
        !["lit-property", "computed-query", "public-ref-member"].includes(
          property.reason,
        ) ||
        (property.writable && property.reason !== "lit-property"),
    ) ||
    new Set(iface.properties.map((property) => property.name)).size !==
      iface.properties.length ||
    encode(iface.writableProperties) !==
      encode(
        iface.properties
          .filter((property) => property.writable)
          .map((property) => property.name),
      )
  )
    refusal("writable-interface-invalid");
  for (const list of [iface.slots, iface.events]) {
    if (
      !Array.isArray(list) ||
      list.some((item) => !object(item) || typeof item.name !== "string") ||
      new Set(list.map((item) => item.name)).size !== list.length
    )
      refusal("named-interface-invalid");
  }
  if (
    !Array.isArray(iface.originalDeclarations) ||
    !Array.isArray(iface.typeDependencies) ||
    iface.typeDependencies.some(
      (dep) =>
        !object(dep) ||
        typeof dep.name !== "string" ||
        typeof dep.version !== "string",
    ) ||
    encode(iface.peerRuntime) !==
      encode({ name: "react", major: 19, mounting: "direct-custom-element" })
  )
    refusal("dependency-interface-invalid");
  if (
    !object(manifest.inputs) ||
    !HASH.test(manifest.inputs.inputRevision) ||
    sha(encode({ ...manifest.inputs, inputRevision: undefined })) !==
      manifest.inputs.inputRevision ||
    !Array.isArray(manifest.inputs.files) ||
    !Array.isArray(manifest.consumedInputs) ||
    !Array.isArray(manifest.stylesheetInputs) ||
    manifest.inputs.files.some(
      (file) =>
        !object(file) ||
        !relativePath(file.path) ||
        !HASH.test(file.sha256) ||
        !Number.isSafeInteger(file.bytes) ||
        file.bytes < 0 ||
        !["source", "dependency", "config-discovery"].includes(file.kind),
    ) ||
    new Set(manifest.inputs.files.map((file) => file.path)).size !==
      manifest.inputs.files.length
  )
    refusal("input-manifest-invalid");
  for (const file of [
    ...manifest.consumedInputs,
    ...manifest.stylesheetInputs,
  ]) {
    const original = manifest.inputs.files.find((input) => input.path === file);
    if (
      !relativePath(file) ||
      !original ||
      original.kind === "config-discovery" ||
      file.includes(`${LIBRARY}/dist/`)
    )
      refusal("unrecorded-build-input");
  }
  const files = new Map<string, Buffer>();
  for (const file of manifest.files) {
    if (
      !object(file) ||
      !relativePath(file.path) ||
      file.path === "manifest.json" ||
      files.has(file.path) ||
      !["module", "stylesheet", "declaration"].includes(file.kind) ||
      !HASH.test(file.sha256) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0
    )
      refusal("file-record-invalid");
    const body = regularRead(root, file.path);
    if (body.length !== file.bytes || sha(body) !== file.sha256)
      refusal("file-hash-mismatch");
    files.set(file.path, body);
  }
  if (
    !files.has(iface.module.path) ||
    !files.has(iface.declaration.path) ||
    manifest.files.find((file) => file.path === iface.module.path)?.kind !==
      "module" ||
    manifest.files.find((file) => file.path === iface.declaration.path)
      ?.kind !== "declaration"
  )
    refusal("entry-missing");
  const walk = (relative: string) => {
    for (const item of readdirSync(path.join(root, relative), {
      withFileTypes: true,
    })) {
      const file = relative ? `${relative}/${item.name}` : item.name;
      if (item.isSymbolicLink()) refusal("output-symlink-or-kind");
      if (item.isDirectory()) walk(file);
      else if (!item.isFile() || (file !== "manifest.json" && !files.has(file)))
        refusal("unrecorded-output-file");
    }
  };
  walk("");
  return {
    artifactRevision: expectedArtifactRevision,
    interfaceRevision: manifest.interfaceRevision,
    manifest,
    files,
    registrationTag: `${iface.tagBase}-runtime-${expectedArtifactRevision.slice(7, 23)}`,
  };
}
