/**
 * Print figma_execute upload snippets for clientStorage chunking.
 * Usage: node scripts/console-loop-upload-parts.mjs /tmp/parts [start] [count]
 * Outputs JSON lines: { i, code } suitable for feeding into figma_execute.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const start = Number(process.argv[3] || 0);
const count = Number(process.argv[4] || 1);
if (!dir) {
  console.error("usage: console-loop-upload-parts.mjs <partsDir> [start] [count]");
  process.exit(2);
}
const meta = JSON.parse(readFileSync(path.join(dir, "meta.json"), "utf8"));
const end = Math.min(meta.n, start + count);
for (let i = start; i < end; i++) {
  const partPath = path.join(dir, `${i}.json`);
  if (!existsSync(partPath)) throw new Error(`missing ${partPath}`);
  const partLit = readFileSync(partPath, "utf8"); // already JSON-stringified chunk
  const code =
    i === 0
      ? `await figma.clientStorage.setAsync('ds_loop_script', ${partLit});\nreturn { i:${i}, stored: ((await figma.clientStorage.getAsync('ds_loop_script'))||'').length };`
      : `const prev = (await figma.clientStorage.getAsync('ds_loop_script')) || '';\nawait figma.clientStorage.setAsync('ds_loop_script', prev + ${partLit});\nreturn { i:${i}, stored: ((await figma.clientStorage.getAsync('ds_loop_script'))||'').length };`;
  console.log(JSON.stringify({ i, code }));
}
