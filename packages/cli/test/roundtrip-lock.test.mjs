import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { acquireLock } from "../src/roundtrip/session.mjs";
import { fixture } from "./roundtrip-fixture.mjs";

for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  test(`${signal} releases the owned lock and permits a retry`, { timeout: 5000 }, async (t) => {
    const f = fixture(t), file = join(f.policy.root, ".lock");
    const module = new URL("../src/roundtrip/session.mjs", import.meta.url).href;
    const child = spawn(process.execPath, ["--input-type=module", "-e",
      `import {acquireLock} from ${JSON.stringify(module)}; acquireLock(${JSON.stringify(file)}); process.send('locked'); setInterval(()=>{},1000);`,
    ], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
    t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
    await once(child, "message");
    assert.throws(() => acquireLock(file), { code: "EEXIST" });
    const stopped = once(child, "exit");
    child.kill(signal);
    assert.deepEqual(await stopped, [code, null]);
    assert.equal(existsSync(file), false);
    const release = acquireLock(file);
    release();
    release();
    assert.equal(existsSync(file), false);
  });
}
