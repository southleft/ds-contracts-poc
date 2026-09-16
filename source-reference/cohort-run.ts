import { deriveLifecycleIdentityPolicy, installLifecycleIdentityProbe, semanticReplayMatches } from "./lifecycle-identity.js";
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { altitudeCohort, altitudeButtonVariants, altitudeRevision } from './altitude-cohort.js';
import { watchSourceFailures } from './observe.js';
import { captureReference, replayReference, archiveInventory } from './replay.js';
import { captureValidatedTree } from './capture.js';
import { readCemDeclarations } from '../extract/adapters/cem.js';
import { captureStableSemantics, assessSemantics } from './semantics.js';

const [origin,checkout,output,selection = 'baseline',parentId,parentSha256] = process.argv.slice(2);
if (!origin || !checkout || !output) throw new Error('Usage: cohort-run.ts <loopback-origin> <altitude-checkout> <new-private-output>');
if (!['baseline','button-variants'].includes(selection)) throw new Error('Unknown fixed source cohort');
const cohort = selection === 'baseline' ? altitudeCohort : altitudeButtonVariants;
const parsed = new URL(origin);
if (parsed.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(parsed.hostname) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Expected unauthenticated loopback origin');
const git = (...args:string[]) => execFileSync('git',['-C',checkout,...args],{encoding:'utf8'}).trim();
if (git('rev-parse','HEAD') !== altitudeRevision || git('diff','HEAD','--name-only')) throw new Error('Source revision or tracked files changed; requalify explicitly');
const sha = (b:Buffer|string) => createHash('sha256').update(b).digest('hex');
// Include all tracked Web Component source plus the generated theme actually
// loaded. HAR separately records runtime transforms, imports and assets.
const sourceFiles = [...new Set([...git('ls-files','libs/al-web-components','pnpm-lock.yaml').split('\n'),
  'libs/al-web-components/styles/dist/tokens.json','libs/al-web-components/styles/dist/scss/theme/tokens-dark.scss'])];
const hashes = Object.fromEntries(sourceFiles.map(f => [f,sha(readFileSync(path.join(checkout,f)))]));
// Supplement only the missing original stories. Bind the new observation to
// existing source bytes; never silently recapture or replace the ten-state run.
let parent: {id:string;measurementSha256:string} | undefined;
if (selection === 'button-variants') {
  if (!parentId || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(parentId) || !parentSha256 || !/^[a-f0-9]{64}$/.test(parentSha256)) throw new Error('Supplement requires exact parent identity');
  const bytes = readFileSync(path.join(path.dirname(output),parentId,'measurement.json'));
  const recorded = JSON.parse(bytes.toString());
  if (sha(bytes) !== parentSha256 || recorded.sourceRevision !== altitudeRevision || recorded.sourceStable !== true || (recorded.cohortId ?? 'baseline') !== 'baseline' || JSON.stringify(recorded.sourceHashes) !== JSON.stringify(hashes)) throw new Error('Parent source bytes differ; do not combine these observations');
  parent = {id:parentId,measurementSha256:parentSha256};
} else if (parentId || parentSha256) throw new Error('Baseline cannot have a parent');
const manifestPath = 'libs/al-web-components/custom-elements.json';
const manifest = readCemDeclarations(JSON.parse(readFileSync(path.join(checkout,manifestPath),'utf8')));
mkdirSync(output,{recursive:false});
const browser = await chromium.launch({headless:true});
const rows:Record<string,unknown>[] = [];
try {
  for (const {story,profile,limitations} of cohort) {
    const dir = path.join(output,story); mkdirSync(dir);
    const har = path.join(dir,'source.har');
    const url = `${parsed.origin}/iframe.html?id=${story}&viewMode=story`;
    let context:Awaited<ReturnType<typeof browser.newContext>> | undefined;
    const row:Record<string,unknown> = {story,profile,limitations,qualified:false};
    try {
      const declarations = manifest.declarations.filter(decl => decl.tagName === profile.path[0]);
      const declaration = declarations.length === 1 ? declarations[0] : undefined;
      const modulePath = declaration && path.posix.join(path.posix.dirname(manifestPath), declaration.modulePath);
      const identityPolicy = declaration && modulePath ? deriveLifecycleIdentityPolicy({ source:readFileSync(path.join(checkout,modulePath),'utf8'), sourceSha256:hashes[modulePath], modulePath:declaration.modulePath, className:declaration.className }, declaration) : undefined;
      context = await browser.newContext({viewport:{width:900,height:600},deviceScaleFactor:1,colorScheme:'dark',serviceWorkers:'block',recordHar:{path:har,content:'embed',mode:'full'}});
      if (identityPolicy) await installLifecycleIdentityProbe(context,identityPolicy);
      const page = await context.newPage(); const failures = watchSourceFailures(page);
      await page.goto(url,{waitUntil:'load',timeout:30000});
      const live = await captureReference(page,profile,failures);
      writeFileSync(path.join(dir,'source.png'),live.screenshot);
      row.source = {status:live.status,problems:live.problems,observation:live.after,sha256:live.secondSha256};
      const sourceTree = live.status === 'valid' ? await captureValidatedTree(page,profile,failures,'#storybook-root','--al-') : {status:'refused' as const,problems:['source-reference-invalid']};
      writeFileSync(path.join(dir,'source-tree.json'),JSON.stringify(sourceTree,null,2)+'\n');
      const sourceSemantics = declaration ? assessSemantics(declaration,await captureStableSemantics(page,[profile.path[0]],declaration,live.secondSha256),{
        valid:live.status === 'valid',sourcePngSha256:live.secondSha256,
        ...(sourceTree.status === 'captured' ? {sourceTreeSha256:sourceTree.treeSha256} : {}),
      },manifest.problems.map(problem=>`${problem.code}:${problem.path}`)) : {status:'refused' as const,problems:['component-declaration-not-unique']};
      writeFileSync(path.join(dir,'source-semantics.json'),JSON.stringify(sourceSemantics,null,2)+'\n');
      failures.dispose(); await context.close(); context = undefined;
      const replay = await replayReference(browser,har,url,profile,undefined,async (replayPage,replayFailures)=>{
        const tree = await captureValidatedTree(replayPage,profile,replayFailures,'#storybook-root','--al-');
        return {tree,semantics:declaration ? await captureStableSemantics(replayPage,[profile.path[0]],declaration,tree.status === 'captured' ? tree.sourcePngSha256 : live.secondSha256) : null};
      }, identityPolicy ? context => installLifecycleIdentityProbe(context,identityPolicy) : undefined);
      const replayTree = replay.inspection?.tree ?? {status:'refused' as const,problems:['replay-reference-invalid']};
      writeFileSync(path.join(dir,'replay-tree.json'),JSON.stringify(replayTree,null,2)+'\n');
      writeFileSync(path.join(dir,'replay-semantics.json'),JSON.stringify(replay.inspection?.semantics ?? null,null,2)+'\n');
      writeFileSync(path.join(dir,'replay.png'),replay.screenshot);
      row.replay = {status:replay.status,problems:replay.problems,observation:replay.after,sha256:replay.secondSha256,matchesSource:replay.secondSha256 === live.secondSha256};
      row.archive = archiveInventory(har);
      row.qualified = live.status === 'valid' && replay.status === 'valid' && replay.secondSha256 === live.secondSha256;
      const treesMatch = sourceTree.status === 'captured' && replayTree?.status === 'captured' && sourceTree.treeSha256 === replayTree.treeSha256 && sourceTree.sourcePngSha256 === live.secondSha256 && replayTree.sourcePngSha256 === replay.secondSha256;
      row.compilerInput = {status:!row.qualified ? 'source-invalid' : treesMatch ? 'verified-capture' : 'capture-refused',
        problems:treesMatch ? [] : [...sourceTree.problems,...(replayTree?.problems ?? []),'source-replay-tree-not-verified'],
        ...(sourceTree.status === 'captured' ? {census:sourceTree.census,boundary:sourceTree.boundary,treeSha256:sourceTree.treeSha256} : {}),
        scope:'Raw compiler input only. Token references are candidates; unreadable stylesheet boundaries are not hidden. No Figma conversion claim.'};
      const semanticMatch = 'observationSha256' in sourceSemantics && replay.inspection?.semantics && semanticReplayMatches(sourceSemantics.observation,replay.inspection.semantics,identityPolicy);
      row.semanticIntake = {
        status:!row.qualified ? 'source-invalid' : sourceSemantics.status === 'observed' && semanticMatch && treesMatch ? 'observed' : 'refused',
        problems:[...sourceSemantics.problems,...(!semanticMatch ? ['semantic-replay-mismatch'] : []),...(!treesMatch ? ['source-tree-not-verified'] : [])],
        manifestSha256:hashes[manifestPath],
        ...('declaration' in sourceSemantics ? {
          tagName:sourceSemantics.declaration.tagName, coverage:sourceSemantics.coverage,
          declaration:sourceSemantics.declaration, observation:sourceSemantics.observation,
          observationSha256:sourceSemantics.observationSha256, declarationSha256:sourceSemantics.declarationSha256,
          limitations:sourceSemantics.limitations,
        } : {limitations:[]}),
        scope:'Declared API and live semantic observations, not accepted contract semantics, behavioral approval or Figma output.',
      };
    } catch {
      // Never drop failed stories. Raw browser errors can contain credential URLs.
      row.error = 'capture-or-replay-failed';
    } finally {
      await context?.close(); rows.push(row);
      writeFileSync(path.join(dir,'measurement.json'),JSON.stringify(row,null,2)+'\n');
      console.log(JSON.stringify({story,qualified:row.qualified,source:row.source && (row.source as {problems:unknown}).problems,replay:row.replay && (row.replay as {problems:unknown}).problems,error:row.error}));
    }
  }
} finally { await browser.close(); }
const sourceStable = git('rev-parse','HEAD') === altitudeRevision && !git('diff','HEAD','--name-only') && sourceFiles.every(f=>sha(readFileSync(path.join(checkout,f))) === hashes[f]);
const record = {recordedAt:new Date().toISOString(),cohortId:selection,...(parent ? {parent} : {}),sourceRevision:altitudeRevision,sourceHashes:hashes,sourceStable,
  engineRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),engineDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),
  browser:browser.version(),denominator:cohort.length,qualified:sourceStable ? rows.filter(r=>r.qualified).length : 0,rows,
  scope:'Source witness and recorded-byte replay only. Not independently rebuilt dependencies, Figma parity, behavior approval, automatic onboarding or completed product journey.'};
writeFileSync(path.join(output,'measurement.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({qualified:record.qualified,denominator:record.denominator,sourceStable}));
if (record.qualified !== record.denominator) process.exitCode = 1;
