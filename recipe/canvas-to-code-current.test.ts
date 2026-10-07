import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {recordCurrentCanvasToCode} from './canvas-to-code-current.js';

test('current recorder refuses the frozen versioned lineage without changing its receipt', async () => {
  const root='recipe/evidence/canvas-to-code-v1',file=root+'/receipt.json';
  const hash=()=>createHash('sha256').update(readFileSync(file)).digest('hex');
  const before=hash();
  await assert.rejects(recordCurrentCanvasToCode(root), /versioned recipe lineage/);
  assert.equal(hash(),before);
});
