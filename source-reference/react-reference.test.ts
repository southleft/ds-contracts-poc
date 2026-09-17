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
    const callbackUrl = base + `/react/${reference.id}/callback-behavior/checkbox-unchecked`;
    assert.equal((await fetch(callbackUrl, {method:'POST',body:JSON.stringify({sourceRoot:'/etc',callback:'arbitrary'})})).status,400);
    assert.equal((await fetch(callbackUrl, {method:'DELETE'})).status,409);
    assert.equal((await fetch(callbackUrl, {method:'POST'})).status,409,'a loaded reference alone cannot replace a sealed source observation');
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
