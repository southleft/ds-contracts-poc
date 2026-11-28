import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runRoundtrip } from "../src/roundtrip/index.mjs";
import { sessionFixture } from "./roundtrip-fixture.mjs";

for (const concurrent of [false, true]) {
  test(`interrupted apply restores owned files and preserves concurrent edits: ${concurrent}`, { timeout: 8000 }, async (t) => {
    const f = sessionFixture(t);
    const before = { state: f.read("session.json"), tokens: f.read("tokens.json"), css: f.read("generated.css") };
    const module = new URL("../src/roundtrip/index.mjs", import.meta.url).href;
    const surface = new URL("../src/roundtrip/surface.mjs", import.meta.url).href;
    const child = spawn(process.execPath, ["--input-type=module", "-e", `
      import {runRoundtrip} from ${JSON.stringify(module)};
      import {hash} from ${JSON.stringify(surface)};
      import {writeFileSync} from 'node:fs';
      await runRoundtrip(${JSON.stringify(f.args)}, {reader:{}, log:()=>{}, captureSource:async (_p,root,_out,_r,{onGenerated})=>{
        const file=root+'/generated.css'; writeFileSync(file,'built'); onGenerated(file,hash('built'));
        process.send('capturing'); setInterval(()=>{},1000); await new Promise(()=>{});
      }});
    `], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
    t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
    await once(child, "message");
    assert.notEqual(f.read("tokens.json"), before.tokens);
    if (concurrent) f.save("tokens.json", "concurrent owner edit");
    const stopped = once(child, "exit");
    child.kill("SIGINT");
    assert.deepEqual(await stopped, [130, null]);
    assert.equal(f.read("tokens.json"), concurrent ? "concurrent owner edit" : before.tokens);
    assert.equal(f.read("generated.css"), before.css);
    assert.equal(f.read("session.json"), before.state);
    assert.equal(existsSync(join(f.dir, ".lock")), false);
    if (!concurrent) assert.equal(await runRoundtrip(f.args, { reader: {}, captureSource: f.captureSource, log: () => {} }), 0);
  });
}
