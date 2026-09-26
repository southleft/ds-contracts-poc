import {observeReactJsxHelpers,reactJsxHelperObservationUnchanged,type ReactJsxHelperObservation} from './react-jsx-helper-observation.js';
import {type ReactJsxValueRequest,type ReactJsxValues} from './react-jsx-values.js';
import {readReactJsxEffects,type ReactJsxEffects} from './react-jsx-effects.js';
import { observeReactHelpers, reactHelperObservationUnchanged, type ReactHelperObservation } from "./react-helper-observation.js";
import type {ReactPropertySnapshot} from './react-root-variants.js';
import {assembleReactRootMatrix,type ReactRootMatrix} from './react-root-matrix.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import type {ReactStyleOrigin} from './react-style-origin.js';
import {observeReactPropertyMatrix,type ReactPropertyMatrix} from './react-property-matrix.js';
import {readReactStyleOrigin} from './react-style-origin.js';
import {observeGridConstraints,hasGridContainer,type GridConstraintEvidence} from './grid-constraints.js';
import { linkReactSourceAnatomy, nestedReactHostPaths, type ReactSourceAnatomy } from './react-source-anatomy.js';
import { projectReactRootVisual, type ReactRootVisual } from './react-root-visual.js';
import {readReactContextualContent} from './react-contextual-content.js';
import {readReactAuthoredContent} from './react-authored-content.js';
import {projectReactAuthoredTree,type ReactAuthoredTreeDraft} from './react-authored-tree.js';
import {observeReactRuntimeDependencies} from './react-runtime-export.js';
import {createReactElementCreationObserver} from './react-element-creation.js';
import {readReactCompiledContent,type ReactCompiledContent} from './react-compiled-content.js';
import {readReactCompiledEffects,type ReactCompiledEffects} from './react-compiled-effects.js';
import type {ReactCompiledValues,ReactCompiledValueRequest} from './react-compiled-values.js';
import { chromium, type Browser } from "playwright-core";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReactOwnershipReference,
  reactOwnershipEntry,
  reactOwnershipHook,
  reactOwnershipRead,
  reactOwnershipMatchesTree,
  type ReactOwnership,
} from "./react-ownership.js";
import {
  reactReferenceHtml,
  reactReferenceUnchanged,
  reactReferenceSourceModules,
  type ReactReference,
} from "./react-reference.js";
import {
  readReactSourceProgram,
  reactSourceProgramUnchanged,
} from "./react-source-program.js";
import { captureValidatedTree } from "./capture.js";
import { watchSourceFailures } from "./observe.js";
import {
  evidenceSha,
  inventoryEvidence,
  evidenceUnchanged,
} from "./react-validation-evidence.js";
export interface ReactOwnershipRow {
  id: string;
  matched: boolean;
  problems: string[];
  sourceImage?: string;
  observedImage?: string;
  treeSha256?: string;
  ownership?: ReactOwnership;
  anatomy?: ReactSourceAnatomy;
  rootVisual?: ReactRootVisual;
  propertyMatrix?: ReactPropertyMatrix;
  rootMatrix?: ReactRootMatrix;
  authoredTrees?:Array<{helper:number;draft?:ReactAuthoredTreeDraft;reason?:string}>;
  helperObservations?: ReactHelperObservation[];
  /** Source-flow candidates at matched compiled creation sites, not authority. */
  jsxEffects?: Array<{path:string;model:ReactJsxEffects}>;
  jsxValues?: Array<{path:string;result:ReactJsxValues}>;
  jsxHelpers?: Array<{path:string;result:ReactJsxHelperObservation}>;
  compiledContent?: ReactCompiledContent[];
  compiledEffects?: Array<{path:string;model:ReactCompiledEffects}>;
  compiledValues?: Array<{path:string;result:ReactCompiledValues}>;
}
export interface ReactOwnershipReport {
  id: string;
  referenceId: string;
  state: "running" | "complete" | "failed";
  acceptedContract: null;
  denominator: number;
  matched: number;
  rows: ReactOwnershipRow[];
  sourceUnchanged: boolean;
  problem?: string;
  engine?: Record<string, string>;
  observedReferenceId?: string;
}
/** Private, paired source observation using the same frozen cases and reader.
 * No render configuration, script, path or role map is accepted from the UI. */
export function startReactOwnership(
  reference: ReactReference,
  sourceRoot: string,
  evidenceRoot: string,
) {
  if (!reactReferenceUnchanged(reference))
    throw Error("react-ownership-source-changed");
  const modules = reactReferenceSourceModules(reference);
  const runtimeDependencies = observeReactRuntimeDependencies(reference,
    readReactSourceProgram(sourceRoot, modules, { includeJsxDependencies: true }));
  const program = runtimeDependencies.program;
  const state: ReactOwnershipReport = {
    id: randomUUID(),
    referenceId: reference.id,
    state: "running",
    acceptedContract: null,
    denominator: reference.cohort.cases.length,
    matched: 0,
    rows: [],
    sourceUnchanged: false,
  };
  const dir = path.join(evidenceRoot, reference.id, state.id);
  mkdirSync(dir, { recursive: true });
  let browser: Browser | undefined,
    stopped = false,
    sealed: Record<string, string> | undefined;
  const unchanged = () =>
    reactReferenceUnchanged(reference) && reactSourceProgramUnchanged(program) &&
    state.rows.every(row=>(row.helperObservations??[]).every(reactHelperObservationUnchanged)&&(row.jsxHelpers??[]).every(item=>reactJsxHelperObservationUnchanged(item.result)));
  const promise = (async () => {
    let terminal: "complete" | "failed" = "complete";
    try {
      const creationObserver = createReactElementCreationObserver(reference,reactOwnershipEntry(sourceRoot,reference,program),program.components);
      const observed = await buildReactOwnershipReference(
        sourceRoot,
        reference,
        program,
        creationObserver,
      );
      creationObserver.complete();
      state.observedReferenceId = observed.id;
      state.engine = reactOwnershipEngine();
      writeFileSync(
        path.join(dir, "program.json"),
        JSON.stringify(program, null, 2) + "\n",
        { flag: "wx" },
      );
      writeFileSync(path.join(dir,"runtime-dependencies.json"),JSON.stringify(runtimeDependencies.observations,null,2)+"\n",{flag:"wx"});
      writeFileSync(path.join(dir,"element-creation.json"),JSON.stringify({sites:creationObserver.sites,invocations:creationObserver.plans,sourceCalls:creationObserver.sourceCalls,changes:creationObserver.changes,transformedSources:creationObserver.transformedSources,transformRefusals:creationObserver.transformRefusals,targets:creationObserver.targets,targetResolutions:creationObserver.targetResolutions,referenceEntry:creationObserver.referenceEntry,acceptedContract:null},null,2)+"\n",{flag:"wx"});
      // Enables read-only CDP identification of the executable used by this run.
      browser = await chromium.launch({args:["--enable-automation"]});
      if (stopped) throw Error("react-ownership-interrupted");
      for (const c of reference.cohort.cases) {
        if (stopped || !unchanged())
          throw Error("react-ownership-interrupted-or-source-changed");
        const row: ReactOwnershipRow = {
          id: c.id,
          matched: false,
          problems: [],
        };
        state.rows.push(row);
        const rowDir = path.join(dir, c.id);
        mkdirSync(rowDir);
        try {
          const pair: Array<{styleOrigin?:ReactStyleOrigin; gridConstraints?:GridConstraintEvidence; tree:string; root:CapturedNode; png:string; ownership?:ReactOwnership}> = [];
          for (const instrumented of [false, true]) {
            const side = instrumented ? "observed" : "source";
            const context = await browser.newContext({
              viewport: { width: 900, height: 600 },
              deviceScaleFactor: 1,
              colorScheme: "light",
            });
            try {
              if (instrumented) await context.addInitScript(reactOwnershipHook+'\n'+creationObserver.hook);
              const url = "http://127.0.0.1/react-ownership?case=" + c.id;
              await context.route("**/*", (route) =>
                route.request().url() === url
                  ? route.fulfill({
                      status: 200,
                      contentType: "text/html",
                      headers: {
                        "Content-Security-Policy":
                          "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'",
                      },
                      body: reactReferenceHtml(
                        instrumented ? observed : reference,
                      ),
                    })
                  : route.abort(),
              );
              const page = await context.newPage(),
                failures = watchSourceFailures(page),
                profile = reference.cohort.profile(c.id);
              await page.goto(url);
              await page.locator(profile.path[0]).waitFor({ timeout: 15000 });
              const tree = await captureValidatedTree(
                page,
                profile,
                failures,
                "#root",
                "--",
              );
              writeFileSync(
                path.join(rowDir, side + "-tree.json"),
                JSON.stringify(tree, null, 2) + "\n",
                { flag: "wx" },
              );
              if (tree.status !== "captured")
                throw Error(
                  "react-ownership-" +
                    side +
                    "-capture-refused:" +
                    tree.problems.join(","),
                );
              const png = await page.screenshot({
                fullPage: true,
                caret: "initial",
              });
              if (evidenceSha(png) !== tree.sourcePngSha256)
                throw Error("react-ownership-render-changed-after-capture");
              writeFileSync(path.join(rowDir, side + ".png"), png, {
                flag: "wx",
              });
              const ownership = instrumented
                ? ((await page.evaluate(
                    reactOwnershipRead(profile.path[0]),
                  )) as ReactOwnership)
                : undefined;
              if (ownership?.problems.length)
                throw Error(ownership.problems.join(","));
              if (ownership) {
                if (!reactOwnershipMatchesTree(ownership, tree.tree))
                  throw Error("react-ownership-captured-paths-differ");
                const again = await page.evaluate(
                  reactOwnershipRead(profile.path[0]),
                );
                if (JSON.stringify(again) !== JSON.stringify(ownership))
                  throw Error("react-ownership-not-stable");
                if (
                  !ownership.components.some(
                    (i) =>
                      i.source.exportName === c.subject && i.roots.includes(""),
                  )
                )
                  throw Error("react-ownership-subject-root-unmatched");
              }
              const ownedHostPaths = ownership ? nestedReactHostPaths(program, ownership, tree.tree) : [];
              const styleOrigin = ownership ? await readReactStyleOrigin(page, profile.path[0], ownership, '#root', ownedHostPaths) : undefined;
              // Same read-only witness the content inspection takes for composed
              // children. The app never re-opens this file: it is the sealed INPUT
              // of the row's sealed `rootVisual`, kept (like style-origin.json) so
              // that projection can be re-derived from the archive alone; the test
              // suite re-derives it. The stability check below covers the read.
              const gridConstraints = ownership && hasGridContainer(tree.tree) ? await observeGridConstraints(page, profile.path, tree.tree) : undefined;
              if (gridConstraints) writeFileSync(path.join(rowDir, "grid-constraints.json"), JSON.stringify(gridConstraints,null,2)+"\n", {flag:"wx"});
              if (styleOrigin) {
                const repeat = await readReactStyleOrigin(page, profile.path[0], ownership!, '#root', ownedHostPaths);
                if (JSON.stringify(styleOrigin) !== JSON.stringify(repeat) ||
                    evidenceSha(await page.screenshot({fullPage:true,caret:"initial"})) !== tree.sourcePngSha256)
                  throw Error("react-ownership-style-origin-unstable");
                writeFileSync(path.join(rowDir, "style-origin.json"), JSON.stringify(styleOrigin,null,2)+"\n", {flag:"wx"});
              }
              if (instrumented && ownership && pair[0]?.tree === tree.treeSha256 && pair[0]?.png === tree.sourcePngSha256) {
                const subjects=ownership.nodes.filter(n=>n.creationSite&&n.creationInvocation);
                if(subjects.length){
                  row.compiledEffects=subjects.map(node=>({path:node.path,model:readReactCompiledEffects(reference,node.creationSite!,node.creationInvocation!)}));
                  const requests:ReactCompiledValueRequest[]=subjects.map((node,i)=>({site:node.creationSite!,observation:node.creationInvocation!,model:row.compiledEffects![i].model}));
                  const serialized=JSON.stringify(requests);
                  const results=await page.evaluate((json)=>
                    (globalThis as unknown as {__DSC_ELEMENT_CREATION:{compareValues(json:string):ReactCompiledValues[]}}).__DSC_ELEMENT_CREATION.compareValues(json),serialized);
                  const repeat=await page.evaluate((json)=>
                    (globalThis as unknown as {__DSC_ELEMENT_CREATION:{compareValues(json:string):ReactCompiledValues[]}}).__DSC_ELEMENT_CREATION.compareValues(json),serialized);
                  if(results.length!==subjects.length||JSON.stringify(results)!==JSON.stringify(repeat)||
                    JSON.stringify(await page.evaluate(reactOwnershipRead(profile.path[0])))!==JSON.stringify(ownership)||
                    evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}))!==tree.sourcePngSha256)
                    throw Error('compiled-values-observation-unstable');
                  row.compiledValues=subjects.map((node,i)=>({path:node.path,result:results[i]}));
                  writeFileSync(path.join(rowDir,'compiled-values.json'),JSON.stringify({requests,results:row.compiledValues},null,2)+'\n',{flag:'wx'});
                }
                const jsx=reactJsxSubjects(ownership);
                if(jsx.length){
                  row.jsxEffects=jsx.map(subject=>({path:subject.path,model:readReactJsxEffects(reference,subject.site,subject.invocation)}));
                  const requests:ReactJsxValueRequest[]=jsx.map((subject,i)=>({site:subject.site,observation:subject.invocation,model:row.jsxEffects![i].model}));
                  const json=JSON.stringify(requests);
                  const results=await page.evaluate((value)=>(globalThis as unknown as {__DSC_ELEMENT_CREATION:{compareJsxValues(json:string):ReactJsxValues[]}}).__DSC_ELEMENT_CREATION.compareJsxValues(value),json);
                  const repeat=await page.evaluate((value)=>(globalThis as unknown as {__DSC_ELEMENT_CREATION:{compareJsxValues(json:string):ReactJsxValues[]}}).__DSC_ELEMENT_CREATION.compareJsxValues(value),json);
                  if(results.length!==jsx.length||JSON.stringify(results)!==JSON.stringify(repeat)||
                    JSON.stringify(await page.evaluate(reactOwnershipRead(profile.path[0])))!==JSON.stringify(ownership)||
                    evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}))!==tree.sourcePngSha256)
                    throw Error('jsx-values-observation-unstable');
                  row.jsxValues=jsx.map((subject,i)=>({path:subject.path,result:results[i]}));
                }
                const target = ownership.components.find(i => i.source.exportName === c.subject && i.roots.includes(""))!;
                row.propertyMatrix = await observeReactPropertyMatrix({page, program, ownership, tree:tree.tree,
                  image:tree.sourcePngSha256, instanceId:target.id, selector:profile.path[0],
                  dir:path.join(rowDir,"matrix"), failures,
                  assertCurrent:()=>{if(stopped || !unchanged())throw Error("react-property-effects-source-changed-or-interrupted");},
                });
              }
              pair.push({
                styleOrigin,
                gridConstraints,
                tree: tree.treeSha256,
                root: tree.tree,
                png: tree.sourcePngSha256,
                ownership,
              });
              failures.dispose();
            } finally {
              await context.close();
            }
          }
          row.sourceImage = pair[0].png;
          row.observedImage = pair[1].png;
          if (pair[0].tree !== pair[1].tree || pair[0].png !== pair[1].png)
            throw Error("react-ownership-observation-changed-reference");
          row.treeSha256 = pair[0].tree;
          row.ownership = pair[1].ownership;
          const creationSites = [...new Map(row.ownership!.nodes.flatMap(node=>node.creationSite?[[JSON.stringify(node.creationSite),node.creationSite] as const]:[])).values()];
          if(creationSites.length){
            row.compiledContent = creationSites.map(site=>readReactCompiledContent(reference,site));
            writeFileSync(path.join(rowDir,'compiled-content.json'),JSON.stringify(row.compiledContent,null,2)+'\n',{flag:'wx'});
            row.compiledEffects ??= row.ownership!.nodes.flatMap(node=>node.creationSite&&node.creationInvocation
              ?[{path:node.path,model:readReactCompiledEffects(reference,node.creationSite,node.creationInvocation)}]:[]);
            writeFileSync(path.join(rowDir,'compiled-effects.json'),JSON.stringify(row.compiledEffects,null,2)+'\n',{flag:'wx'});
            row.jsxEffects ??= reactJsxSubjects(row.ownership!).map(subject=>({path:subject.path,model:readReactJsxEffects(reference,subject.site,subject.invocation)}));
            writeFileSync(path.join(rowDir,'jsx-effects.json'),JSON.stringify(row.jsxEffects,null,2)+'\n',{flag:'wx'});
            if(row.jsxValues)writeFileSync(path.join(rowDir,'jsx-values.json'),JSON.stringify(row.jsxValues,null,2)+'\n',{flag:'wx'});
          }
          row.helperObservations = await observeReactHelpers({browser,reference,program,ownership:pair[1].ownership!,caseId:c.id,
            treeSha256:pair[0].tree,pngSha256:pair[0].png,dir:path.join(rowDir,'helpers'),
            assertCurrent:()=>{if(stopped||!unchanged())throw Error('helper-observation-source-changed-or-interrupted');},
          });
          row.jsxHelpers=[];
          for(const [index,entry] of (row.jsxEffects??[]).entries()){
            row.jsxHelpers.push({path:entry.path,result:await observeReactJsxHelpers({browser,reference,program,ownership:row.ownership!,model:entry.model,caseId:c.id,
              treeSha256:pair[0].tree,pngSha256:pair[0].png,dir:path.join(rowDir,'jsx-helpers',String(index)),engine:state.engine!,
              assertCurrent:()=>{if(stopped||!unchanged())throw Error('jsx-helper-source-changed-or-interrupted');}})});
          }
          writeFileSync(path.join(rowDir,'jsx-helpers.json'),JSON.stringify(row.jsxHelpers,null,2)+'\n',{flag:'wx'});
          const contentContext=row.helperObservations.some(h=>h.containingFlow?.status==='observed'&&h.containingFlow.content==='forwarded')
            ?readReactContextualContent({referenceId:reference.id,sourceRoot:reference.sourceRoot,program,ownership:row.ownership!,tree:pair[0].root,helpers:row.helperObservations,
              read:(id,name)=>readFileSync(path.join(rowDir,'helpers',id,name))}):undefined;
          row.anatomy = linkReactSourceAnatomy(program, pair[1].ownership!, pair[0].root,contentContext);
          row.rootVisual = projectReactRootVisual(program, pair[1].ownership!, pair[0].root, pair[1].styleOrigin, undefined, undefined, pair[1].gridConstraints,contentContext);
          if(row.propertyMatrix){
            const snapshots:Record<string,ReactPropertySnapshot>=Object.fromEntries(row.propertyMatrix.rows
              .filter(effect=>effect.status==="observed")
              .map(effect=>[effect.id,JSON.parse(readFileSync(path.join(rowDir,"matrix",effect.id+".json"),"utf8"))]));
            row.authoredTrees=[];
            for(const [index,helper] of row.jsxHelpers.entries()){
              if(helper.path!==''||!helper.result.renderGraph?.rows.some(r=>r.steps.some(s=>s.membership)))continue;
              try{
                const baseline=row.propertyMatrix.rows.find(r=>r.baseline),snapshot=baseline&&snapshots[baseline.id];
                if(!snapshot?.fonts||snapshot.treeSha256!==pair[0].tree||JSON.stringify(snapshot.ownership)!==JSON.stringify(row.ownership))throw Error('react-authored-tree-baseline-unavailable');
                const content=readReactAuthoredContent({referenceId:reference.id,sourceRoot:reference.sourceRoot,program,ownership:row.ownership!,tree:pair[0].root,
                  helper:helper.result,read:name=>readFileSync(path.join(rowDir,'jsx-helpers',String(index),name))});
                row.authoredTrees.push({helper:index,draft:projectReactAuthoredTree({content,program,ownership:row.ownership!,tree:pair[0].root,origin:snapshot.styleOrigin,fonts:snapshot.fonts})});
              }catch(error){row.authoredTrees.push({helper:index,reason:error instanceof Error?error.message:String(error)});}
            }
            writeFileSync(path.join(rowDir,'authored-trees.json'),JSON.stringify(row.authoredTrees,null,2)+'\n',{flag:'wx'});
            row.rootMatrix=assembleReactRootMatrix(program,pair[1].ownership!,pair[0].root,row.propertyMatrix,snapshots,undefined,contentContext);
            writeFileSync(path.join(rowDir,"root-matrix.json"),JSON.stringify(row.rootMatrix,null,2)+"\n",{flag:"wx"});
          }
          row.matched = true;
          writeFileSync(
            path.join(rowDir, "ownership.json"),
            JSON.stringify(row.ownership, null, 2) + "\n",
            { flag: "wx" },
          );
        } catch (error) {
          row.problems.push(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
      if (!unchanged()) throw Error("react-ownership-source-changed");
    } catch (error) {
      terminal = "failed";
      state.problem = error instanceof Error ? error.message : String(error);
    } finally {
      await browser?.close().catch(() => {});
      state.sourceUnchanged = unchanged();
      if (stopped || !state.sourceUnchanged) {
        terminal = "failed";
        state.problem = stopped
          ? "react-ownership-interrupted"
          : "react-ownership-source-changed";
      }
      if (terminal === "failed")
        for (const row of state.rows) { row.matched = false; delete row.anatomy; delete row.rootVisual; delete row.propertyMatrix; delete row.rootMatrix; delete row.authoredTrees; delete row.helperObservations; delete row.compiledContent; delete row.compiledEffects; delete row.compiledValues; delete row.jsxEffects; delete row.jsxValues; delete row.jsxHelpers; }
      state.matched = state.rows.filter((r) => r.matched).length;
      writeFileSync(
        path.join(dir, "report.json"),
        JSON.stringify({ ...state, state: terminal }, null, 2) + "\n",
        { flag: "wx" },
      );
      sealed = inventoryEvidence(dir);
      // The host pins this seal when preparing a native operation. Its hash is
      // retained by the journal, allowing re-opening after a server restart.
      const seal = JSON.stringify({ version: 1, files: sealed }, null, 2) + '\n';
      writeFileSync(path.join(dir, 'integrity.json'), seal, { flag: 'wx' });
      sealed = Object.fromEntries(Object.entries({ ...sealed, 'integrity.json': evidenceSha(seal) })
        .sort(([a], [b]) => a.localeCompare(b)));
      state.state = terminal;
    }
  })();
  return {
    state,
    dir,
    promise,
    report: (): ReactOwnershipReport => {
      const current = unchanged(),
        intact =
          state.state === "running" ||
          (!!sealed && evidenceUnchanged(dir, sealed));
      return current && intact
        ? state
        : {
            ...state,
            matched: 0,
            sourceUnchanged: current,
            problem: current
              ? "react-ownership-evidence-changed"
              : "react-ownership-source-changed",
            rows: state.rows.map((r) => ({ ...r, matched: false, anatomy: undefined, rootVisual: undefined, propertyMatrix: undefined, rootMatrix: undefined, authoredTrees: undefined, helperObservations: undefined, compiledContent:undefined, compiledEffects:undefined, compiledValues:undefined, jsxEffects:undefined, jsxValues:undefined, jsxHelpers:undefined })),
          };
    },
    close: () => {
      stopped = true;
      void browser?.close().catch(() => {});
    },
  };
}

/** One actual returned original function per observed invocation. */
export function reactJsxSubjects(ownership:ReactOwnership){
  const seen=new Set<string>();
  return ownership.nodes.flatMap(node=>{
    const subjects=[...(node.creationSite&&node.creationInvocation?[{site:node.creationSite,invocation:node.creationInvocation}]:[]),
      ...(node.creationLineage?.parents??[]).map(parent=>parent.enclosingReturn??parent)];
    return subjects.flatMap(subject=>{
      if(!subject.site.originalJsx||subject.invocation?.status!=='observed')return [];
      const key=JSON.stringify([subject.site,subject.invocation.invocation]);if(seen.has(key))return [];seen.add(key);
      return [{path:node.path,site:subject.site,invocation:subject.invocation}];
    });
  });
}

/** Current observer dependencies, shared by baseline and finite initial renders. */
export function reactOwnershipEngine():Record<string,string>{
      const root = path.dirname(fileURLToPath(import.meta.url));
      return Object.fromEntries(
        [
          "react-ownership.ts",
          "react-ownership-run.ts",
          "react-reference.ts",
          "react-source-program.ts",
          "react-context-export.ts",
          "react-children.ts",
          "react-helper-effects.ts",
          "react-contextual-content.ts",
          "react-runtime-export.ts",
          "react-element-creation.ts",
          "react-element-invocation.ts",
          "react-element-source-call.ts",
          "react-element-composition.ts",
          "react-jsx-invocation.ts",
          "react-jsx-effects.ts",
          "react-jsx-values.ts",
          "react-jsx-helper-observation.ts",
          "react-jsx-lookup.ts",
          "react-target-initializer.ts",
          "react-target-effects.ts",
          "react-target-callbacks.ts",
          "react-target-callback-plan.ts",
          "react-target-callback-runtime.ts",
          "react-target-callback-values.ts",
          "react-context-runtime.ts",
          "react-context-calls.ts",
          "react-context-adapter.ts",
          "react-effect-hooks.ts",
          "react-effect-runtime.ts",
          "react-ref-hooks.ts",
          "react-ref-runtime.ts",
          "react-context-verification.ts",
          "react-callback-runtime.ts",
          "react-render-graph-runtime.ts",
          "react-render-graph.ts",
          "react-authored-content.ts",
          "react-authored-tree.ts",
          "observed-component-placement.ts",
          "observed-content.ts",
          "svg-viewports.ts",
          "pseudo-boxes.ts",
          "layout-unit.ts",
          "../extract/computed/anatomy.ts",
          "../extract/computed/flow-pseudo.ts",
          "../packages/schema/src/contract-schema.ts",
          "../packages/core/src/validate.ts",
          "react-consumer-literals.ts",
          "react-consumer-literal-runtime.ts",
          "react-hook-helpers.ts",
          "react-hook-helper-runtime.ts",
          "react-hook-helper-verification.ts",
          "react-state-runtime.ts",
          "react-state-adapter.ts",
          "react-callback-factories.ts",
          "react-callback-factory-runtime.ts",
          "react-callback-source-runtime.ts",
          "react-callback-sources.ts",
          "react-callback-creation.ts",
          "react-target-projection.ts",
          "react-target-projection-runtime.ts",
          "react-target-initializer-runtime.ts",
          "react-element-closure.ts",
          "react-element-effects.ts",
          "react-element-provenance.ts",
          "react-compiled-content.ts",
          "react-compiled-effects.ts",
          "react-compiled-values.ts",
          "react-helper-model.mjs",
          "react-helper-model.d.mts",
          "react-helper-observation.ts",
          "react-helper-instrument.ts",
          "react-helper-transform.ts",
          "react-helper-runtime.ts",
          "react-helper-intrinsics.ts",
          "react-helper-binding-runtime.ts",
          "react-source-anatomy.ts",
          "react-root-visual.ts",
          "react-style-origin.ts",
          "grid-constraints.ts",
          "react-child-context.ts",
          "react-property-probe.ts",
          "react-property-effects.ts",
          "react-property-fonts.ts",
          "text-fonts.ts",
          "react-root-variants.ts",
          "react-property-matrix.ts",
          "react-root-matrix.ts",
          "react-root-sweep.ts",
          "react-root-sizing.ts",
          "react-program-proposal.ts",
          "../extract/computed/fuse.ts",
          "../core/mint-tokens.ts",
          "../core/emit-figma-script.ts",
          "../core/native-contract-draft.ts",
          "../core/native-paint-observation.ts",
          "capture.ts",
          "react-reference-profiles.ts",
          "react-reference-cases.ts",
          "react-cohort.ts",
        ].map((f) => [f, evidenceSha(readFileSync(path.join(root, f)))]),
      );
}
