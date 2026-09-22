import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { runInNewContext } from "node:vm";
import {
  buildReactReference,
  createReactReferenceService,
  reactReferenceHtml,
  reactReferenceUnchanged,
} from "./react-reference.js";
import { reactReferenceCases } from "./react-reference-cases.js";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "react-originals-"));
  const put = (file: string, contents: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), contents);
  };
  put("package.json", '{"type":"module"}');
  put("package-lock.json", "{}");
  put("tsconfig.json", "{}");
  put("src/index.css", ":root{--original:red}");
  put("capture-input.css", ":root{--original:red}");
  put("tailwind.css", ":root{--original:red}");
  put(
    "src/components/ui/button.tsx",
    "import React from 'react';export const Button=(props)=> <button {...props}/>;",
  );
  put(
    "src/components/ui/checkbox.tsx",
    "import React from 'react';export const Checkbox=(props)=> <input type='checkbox' {...props}/>;",
  );
  put(
    "src/components/ui/card.tsx",
    "import React from 'react';const Part=(props)=><div {...props}/>;export {Part as Card,Part as CardHeader,Part as CardTitle,Part as CardDescription,Part as CardContent,Part as CardFooter};",
  );
  put("node_modules/lucide-react/package.json", '{"main":"index.js"}');
  put("node_modules/lucide-react/index.js", "export const PlusIcon=()=>null;");
  put(
    "node_modules/@fontsource-variable/inter/package.json",
    '{"main":"index.css"}',
  );
  put(
    "node_modules/@fontsource-variable/inter/index.css",
    "body{font-family:sans-serif}",
  );
  for (const name of ["react", "react-dom", "scheduler"])
    symlinkSync(
      path.resolve("node_modules", name),
      path.join(root, "node_modules", name),
      "dir",
    );
  return { root, put };
}

test("reference bytes are deterministic, source changes invalidate them, and raw-text literals cannot escape the document", async () => {
  const { root, put } = fixture();
  try {
    const first = await buildReactReference(root);
    const again = await buildReactReference(root);
    assert.equal(first.id, again.id);
    assert.ok(reactReferenceUnchanged(first));
    assert.ok(
      Object.keys(first.files).some((f) =>
        f.endsWith("/src/components/ui/card.tsx"),
      ),
    );
    assert.ok(Object.keys(first.files).some((f) => f.includes("/react/")));
    const escaped = reactReferenceHtml({
      ...first,
      javascript: 'const label="</script><script>escaped()</script>"',
      css: "/* </style><script>escaped()</script> */",
    });
    assert.equal((escaped.match(/<\/script>/g) ?? []).length, 2); // actual closing tag plus inert text inside style
    assert.equal((escaped.match(/<\/style>/g) ?? []).length, 1);
    put(
      "src/components/ui/button.tsx",
      readFileSync(path.join(root, "src/components/ui/button.tsx"), "utf8") +
        "\n// source changed\n",
    );
    assert.equal(reactReferenceUnchanged(first), false);
    assert.notEqual((await buildReactReference(root)).id, first.id);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source CSS Modules retain distinct class maps, composition and authenticated original bytes", async () => {
  const { root, put } = fixture();
  try {
    put("first.module.css", ".root { padding: 7px } .label { color: red }");
    put("second.module.css", '.root { composes: label from "./first.module.css"; padding: 11px }');
    put("global.css", ".root { margin: 3px }");
    const entry = 'import a from "./first.module.css"; import b from "./second.module.css"; import "./global.css"; globalThis.maps = { a, b };';
    const first = await buildReactReference(root, undefined, entry);
    const scope: { maps?: { a: Record<string, string>; b: Record<string, string> } } = {};
    runInNewContext(first.javascript, scope);
    const { a, b } = scope.maps!;
    assert.ok(a.root && a.label && b.root, "imports supply usable class names");
    assert.notEqual(a.root, b.root.split(" ")[0], "identical local names stay isolated");
    assert.ok(b.root.split(" ").includes(a.label), "cross-file composition retains the referenced class");
    assert.ok(first.css.includes(`.${a.root} {\n  padding: 7px;`));
    assert.ok(first.css.includes(".root {\n  margin: 3px;"), "ordinary CSS stays global");
    for (const name of ["first.module.css", "second.module.css", "global.css"])
      assert.ok(first.files[path.join(first.sourceRoot, name)], `${name} is authenticated`);
    assert.equal((await buildReactReference(root, undefined, entry)).id, first.id);
    assert.ok(reactReferenceUnchanged(first));
    put("first.module.css", ".root { padding: 9px } .label { color: red }");
    assert.equal(reactReferenceUnchanged(first), false);
    assert.notEqual((await buildReactReference(root, undefined, entry)).id, first.id);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reference API retains all ten cases, isolates source execution and refuses changed or caller-selected input", async () => {
  const { root, put } = fixture();
  const repo = mkdtempSync(path.join(tmpdir(), "react-originals-repo-"));
  const handle = createReactReferenceService(repo, root);
  const server = createServer((req, res) => {
    void handle(req, res, (req.url ?? "").split("?")[0].slice(1));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    assert.equal(
      (
        await fetch(base + "/react", {
          method: "POST",
          body: JSON.stringify({ sourceRoot: "/etc" }),
        })
      ).status,
      400,
    );
    const response = await fetch(base + "/react", { method: "POST" });
    assert.equal(response.status, 200);
    const reference = await response.json();
    assert.equal(reference.qualification, "unqualified");
    assert.equal(reference.cases.length, 10);
    assert.equal(
      (
        await fetch(base + `/react/${reference.id}/ownership`, {
          method: "POST",
          body: "{}",
        })
      ).status,
      400,
    );
    assert.equal(
      (await fetch(base + `/react/${reference.id}/ownership`)).status,
      404,
    );

    assert.deepEqual(
      reference.cases.map((c: { id: string }) => c.id),
      reactReferenceCases.map((c) => c.id),
    );
    const asset = await fetch(
      base + `/react/${reference.id}?case=card-composed`,
    );
    assert.equal(asset.status, 200);
    assert.match(
      asset.headers.get("content-security-policy")!,
      /sandbox allow-scripts/,
    );
    assert.match(
      asset.headers.get("content-security-policy")!,
      /connect-src 'none'/,
    );
    assert.equal(asset.headers.get("cache-control"), "no-store");
    assert.equal(
      (await fetch(base + `/react/${reference.id}?case=omitted-case`)).status,
      404,
    );
    assert.equal(
      (await fetch(base + `/react/${"a".repeat(64)}?case=card-composed`))
        .status,
      404,
    );
    assert.equal(
      (await (await fetch(base + "/react", { method: "POST" })).json()).id,
      reference.id,
    );
    const stateApiUrl = base + `/react/${reference.id}/state-api/checkbox-unchecked`;
    assert.equal((await fetch(stateApiUrl, {method:'POST',body:JSON.stringify({controlled:'arbitrary'})})).status,400);
    assert.equal((await fetch(stateApiUrl, {method:'DELETE'})).status,400);
    assert.equal((await fetch(stateApiUrl, {method:'POST'})).status,409,'a loaded reference cannot replace authenticated state evidence');
    assert.equal((await fetch(stateApiUrl + '/preview')).status,409);
    assert.equal((await fetch(stateApiUrl + '/preview',{method:'POST',body:'{}'})).status,400);
    const stateNativeUrl=base+`/react/${reference.id}/native-state-api/checkbox-unchecked`;
    for(const init of [{method:'POST'},{method:'POST',body:JSON.stringify({contract:{},fileKey:'other'})}])
      assert.equal((await fetch(stateNativeUrl,init)).status,409,'no sealed state evidence means no native operation');
    const callbackUrl = base + `/react/${reference.id}/callback-behavior/checkbox-unchecked`;
    assert.equal((await fetch(callbackUrl, {method:'POST',body:JSON.stringify({sourceRoot:'/etc',callback:'arbitrary'})})).status,400);
    assert.equal((await fetch(callbackUrl, {method:'DELETE'})).status,409);
    assert.equal((await fetch(callbackUrl, {method:'POST'})).status,409,'a loaded reference alone cannot replace a sealed source observation');
    const previewUrl = base + `/react/${reference.id}/behavior-preview/checkbox-unchecked`;
    assert.equal((await fetch(previewUrl)).status,409,'a loaded reference cannot authorize generated preview without verified observations');
    assert.equal((await fetch(previewUrl,{method:'POST',body:'{}'})).status,409,'the preview accepts no caller-supplied contract or code');
    const callerUrl = base + `/react/${reference.id}/native-operation/10000000-0000-4000-8000-000000000001/caller-react`;
    assert.equal((await fetch(callerUrl)).status, 409);
    assert.equal((await fetch(callerUrl + '/preview', { method: 'POST', body: '{}' })).status, 409);
    for (const init of [{}, { method: 'POST' }, { method: 'DELETE' }, { method: 'POST', body: '{}' }])
      assert.equal((await fetch(callerUrl + '/source-frame', init)).status, 409,
        'source framing requires a saved root operation for the composed case and accepts no caller-supplied input');
    for (const kind of ['initial-states', 'callback-behavior']) {
      const contextual = callerUrl + '/child/instance-5/' + kind;
      assert.equal((await fetch(contextual)).status, 409, 'contextual observation requires a saved operation and ownership');
      assert.equal((await fetch(contextual, { method: 'POST', body: JSON.stringify({ contract: {}, sourceRoot: '/etc' }) })).status, 409);
      assert.equal((await fetch(contextual, { method: 'DELETE' })).status, 409);
    }
    const programUrl = base + `/react/${reference.id}/program`;
    assert.equal(
      (
        await fetch(programUrl, {
          method: "POST",
          body: JSON.stringify({ modules: ["/etc/passwd"] }),
        })
      ).status,
      400,
    );
    const programResponse = await fetch(programUrl, { method: "POST" });
    assert.equal(programResponse.status, 200);
    const program = await programResponse.json();
    assert.equal(program.acceptedContract, null);
    assert.equal(program.referenceId, reference.id);
    assert.equal(
      program.status,
      "refused",
      "fixture lacks installed declarations and JSX config; never claim complete API extraction",
    );
    assert.ok(program.problems.length > 0);
    assert.equal(
      (await (await fetch(programUrl, { method: "POST" })).json()).id,
      program.id,
    );
    const recordPath = path.join(
      repo,
      "private/react-source-programs",
      reference.id,
      program.id + ".json",
    );
    const recorded = JSON.parse(readFileSync(recordPath, "utf8"));
    assert.equal(recorded.program.acceptedContract, null);
    writeFileSync(recordPath, "changed");
    assert.equal(
      (await fetch(programUrl, { method: "POST" })).status,
      409,
      "immutable records cannot be restamped",
    );
    put("tailwind.css", "body{display:none}");
    assert.equal(
      (await fetch(base + `/react/${reference.id}?case=card-composed`)).status,
      409,
    );
    const changed = await (
      await fetch(base + "/react", { method: "POST" })
    ).json();
    assert.notEqual(changed.id, reference.id);
    const archived = JSON.parse(
      readFileSync(
        path.join(
          repo,
          "private/react-source-references",
          reference.id,
          "provenance.json",
        ),
        "utf8",
      ),
    );
    assert.equal(
      archived.id,
      reference.id,
      "old reference remains preserved after source change",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});


test("native progress HTTP reads cannot expose verification authority, recompile source or mutate delivery", async t => {
  const {root}=fixture(),repo=mkdtempSync(path.join(tmpdir(),'react-progress-route-'));
  t.after(()=>{rmSync(root,{recursive:true,force:true});rmSync(repo,{recursive:true,force:true});});
  const parent='10000000-0000-4000-8000-000000000008',proposal='a'.repeat(64);
  let referenceId='',heavyReads=0,progressReads=0,refusal='';
  let state:{phase:string;pendingPhase?:string}={phase:'update-preflight-observed'};
  const heavy=()=>{heavyReads++;throw Error('full verification must not run during progress');};
  const progress=()=>{progressReads++;if(refusal)throw Error(refusal);return state;};
  const handle=createReactReferenceService(repo,root,()=>({jobs:{listReact:()=>[],get:heavy,
    withReadSnapshot:(read:()=>unknown)=>read(),
    reactIdentity:(id:string)=>{if(id!==parent)throw Error('native-operation-unavailable');return {referenceId};},
    deliveryState:(id:string)=>{assert.equal(id,parent);return progress();}},
    transport:{status:heavy,pair:heavy,start:heavy},updateJobs:{forProposal:heavy,get:heavy,prepare:heavy,
      deliveryStateForProposal:(p:string,id:string)=>{assert.equal(p,parent);if(id!==proposal)throw Error('native-update-unavailable');return progress();}}
  } as any));
  const server=createServer((req,res)=>{void handle(req,res,(req.url??'').slice(1));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  referenceId=(await (await fetch(base+'/react',{method:'POST'})).json()).id;
  const rootRoute=`${base}/react/${referenceId}/native-operation/${parent}/progress`;
  const updateRoute=`${base}/react/${referenceId}/native-operation/${parent}/update/${proposal}/progress`;
  for(const route of [rootRoute,updateRoute]) {
    for(const phase of ['prepared','tokens-created','tokens-observed','components-created','comparison-repair-observed','comparison-recovery-observed','update-prepared','update-preflight-observed','update-applied']) {
      state={phase};const response=await fetch(route);
      assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
      assert.deepEqual(await response.json(),{pending:true});
    }
    state={phase:'update-verified'};assert.deepEqual(await (await fetch(route)).json(),{pending:false});
    state={phase:'update-verified',pendingPhase:'update-readback'};
    assert.deepEqual(await (await fetch(route)).json(),{pending:true});
    state={phase:'update-refused'};assert.deepEqual(await (await fetch(route)).json(),{pending:false});
    const before=progressReads;
    for(const method of ['POST','PUT','DELETE']) assert.equal((await fetch(route,{method})).status,409);
    assert.equal(progressReads,before,'non-GET requests never reach the journal');
  }
  refusal='native-update-journal-chain-invalid';
  const damaged=await fetch(updateRoute);assert.equal(damaged.status,409);
  assert.equal((await damaged.json()).reason,refusal);
  refusal='';
  assert.equal((await fetch(updateRoute.replace(proposal,'b'.repeat(64)))).status,409);
  assert.equal((await fetch(rootRoute.replace(parent,'20000000-0000-4000-8000-000000000009'))).status,409);
  const before=progressReads;referenceId='c'.repeat(64);
  assert.equal((await fetch(rootRoute)).status,409);assert.equal((await fetch(updateRoute)).status,409);
  assert.equal(progressReads,before);assert.equal(heavyReads,0);
});

test("update image HTTP delivery uses the checked archive without a current-source snapshot", async t => {
  const {root}=fixture(),repo=mkdtempSync(path.join(tmpdir(),'react-image-route-'));
  t.after(()=>{rmSync(root,{recursive:true,force:true});rmSync(repo,{recursive:true,force:true});});
  const parent='10000000-0000-4000-8000-000000000008',proposal='a'.repeat(64),hash='b'.repeat(64);
  let referenceId='',reads=0;
  const png=Buffer.from('checked archive image');
  const handle=createReactReferenceService(repo,root,()=>({jobs:{listReact:()=>[],reactIdentity:(id:string)=>{
    assert.equal(id,parent);return {referenceId};}},transport:{},updateJobs:{
    forProposal:()=>{throw Error('must not recompile the current source for an image');},
    imageForProposal:(p:string,id:string,h:string)=>{assert.equal(p,parent);assert.equal(id,proposal);assert.equal(h,hash);reads++;return png;}
  }} as any));
  const server=createServer((req,res)=>{void handle(req,res,(req.url??'').slice(1));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  referenceId=(await (await fetch(base+'/react',{method:'POST'})).json()).id;
  const route=`/react/${referenceId}/native-operation/${parent}/update/${proposal}/images/${hash}.png`;
  const response=await fetch(base+route);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
  assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  assert.equal(reads,1);
  assert.equal((await fetch(base+route,{method:'POST'})).status,409);assert.equal(reads,1);
  referenceId='c'.repeat(64);
  assert.equal((await fetch(base+route)).status,409);assert.equal(reads,1);
});

test("attest-dead is a bodiless POST that reaches only the update transport, and refuses by name", async t => {
  const {root}=fixture(),repo=mkdtempSync(path.join(tmpdir(),'react-attest-route-'));
  t.after(()=>{rmSync(root,{recursive:true,force:true});rmSync(repo,{recursive:true,force:true});});
  const parent='10000000-0000-4000-8000-000000000008',proposal='a'.repeat(64),update='20000000-0000-4000-8000-000000000009';
  let referenceId='',refusal:string|undefined;const calls:string[]=[];
  const handle=createReactReferenceService(repo,root,()=>({jobs:{listReact:()=>[],listReactMoved:()=>[],withReadSnapshot:(f:()=>unknown)=>f(),reactIdentity:()=>({referenceId})},transport:{},
    updateJobs:{idForProposal:(p:string,id:string)=>{assert.equal(p,parent);assert.equal(id,proposal);return update;},
      forProposal:()=>{throw Error('must not compute a display result to identify an action');},prepare:()=>{throw Error('must not prepare');}},
    updateTransport:{attestDead:(id:string)=>{calls.push(id);if(refusal)throw Error(refusal);},
      resolveWriteOutcome:()=>{throw Error('must not settle');},rearmWrite:()=>{throw Error('must not rearm');}}} as any));
  const server=createServer((req,res)=>{void handle(req,res,(req.url??'').slice(1));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  referenceId=(await (await fetch(base+'/react',{method:'POST'})).json()).id;
  const route=`${base}/react/${referenceId}/native-operation/${parent}/update/${proposal}/attest-dead`;
  const body=await fetch(route,{method:'POST',headers:{'content-type':'application/json'},body:'{"statement":"gone"}'});
  assert.equal(body.status,409);assert.equal((await body.json()).reason,'react-native-body-refused');
  assert.deepEqual(calls,[],'a body never reaches the journal');
  refusal='native-transport-write-attestation-refused';
  const notStarted=await fetch(route,{method:'POST'});
  assert.equal(notStarted.status,409);assert.equal((await notStarted.json()).reason,'native-transport-write-attestation-refused');
  refusal='native-update-attest-dead-companion-connected';
  assert.equal((await (await fetch(route,{method:'POST'})).json()).reason,'native-update-attest-dead-companion-connected');
  refusal=undefined;
  assert.equal((await fetch(route,{method:'POST'})).status,200);
  assert.deepEqual(calls,[update,update,update]);
});

test("attest-dead is behind the service's same-origin guard, and an unstarted update refuses by name", async t => {
  const { createReferenceService } = await import("./service.js");
  const { createNativeOperationTransport } = await import("./native-operation-transport.js");
  const repo=mkdtempSync(path.join(tmpdir(),'react-attest-origin-'));t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const service=createReferenceService(repo);
  const server=createServer((req,res)=>{void service.handle(req,res);});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/source-reference`;
  const route=`${base}/react/${'c'.repeat(64)}/native-operation/10000000-0000-4000-8000-000000000008/update/${'a'.repeat(64)}/attest-dead`;
  const foreign=await fetch(route,{method:'POST',headers:{origin:'http://evil.example'}});
  assert.equal(foreign.status,403);assert.match((await foreign.json()).error,/Same-origin/);
  // The transport refuses an update that was never started, whatever the journal says.
  const id='30000000-0000-4000-8000-00000000000a';let reached=false;
  const transport=createNativeOperationTransport(repo,{get:()=>({phase:'awaiting-native-result',sourceCurrent:true}),
    deliveryState:()=>({phase:'awaiting-native-result',fileKey:'k'}),attestDead:()=>{reached=true;}} as any);
  transport.pair(id);
  assert.throws(()=>transport.attestDead(id),/^Error: native-transport-write-attestation-refused$/);assert.equal(reached,false);
});
