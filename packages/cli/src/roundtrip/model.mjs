import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTree, findNodeAtLocation } from 'jsonc-parser';

import { hash, values } from './surface.mjs';
export const read = (p) => readFileSync(p, 'utf8');
export function patchJSON(text, path, before, after) {
  const node = findNodeAtLocation(parseTree(text), path);
  assert(node, 'missing source path');
  assert.deepEqual(JSON.parse(text.slice(node.offset, node.offset + node.length)), before, 'stale source value');
  return text.slice(0, node.offset) + JSON.stringify(after) + text.slice(node.offset + node.length);
}
export function resolveBundle(B) {
  const gaps = [],
    tokenOrder = [],
    componentOrder = [],
    seen = new Set(),
    active = new Set(),
    componentSeen = new Set(),
    componentActive = new Set();
  const walkToken = (id) => {
    if (active.has(id)) {
      gaps.push({ code: 'token-cycle', id });
      return;
    }
    if (seen.has(id)) return;
    const t = B.system.tokens[id];
    if (!t) {
      gaps.push({ code: 'missing-token', id });
      return;
    }
    active.add(id);
    if (t.alias) {
      walkToken(t.alias);
      if (B.system.tokens[t.alias]?.type !== t.type) gaps.push({ code: 'token-type-mismatch', id });
    } else if (!/^#[\da-f]{6}$/i.test(t.value ?? '')) gaps.push({ code: 'unsupported-color', id });
    active.delete(id);
    seen.add(id);
    tokenOrder.push(id);
  };
  Object.keys(B.system.tokens).sort().forEach(walkToken);
  const walkComponent = (id, by) => {
    if (componentActive.has(id)) {
      gaps.push({ code: 'component-cycle', id, requiredBy: by });
      return;
    }
    if (componentSeen.has(id)) return;
    const c = B.components[id];
    if (!c) {
      gaps.push({
        code: 'missing-component-contract',
        id,
        requiredBy: by,
        action: 'Capture or supply this component contract before generating its parent.',
      });
      return;
    }
    componentActive.add(id);
    if (c.systemRef.id !== B.system.id || c.systemRef.revision !== B.system.revision)
      gaps.push({ code: 'system-revision-mismatch', id });
    for (const d of c.requires ?? []) {
      walkComponent(d.id, id);
      if (B.components[d.id] && B.components[d.id].revision !== d.revision)
        gaps.push({ code: 'dependency-revision-mismatch', id: d.id, requiredBy: id });
    }
    for (const s of Object.values(c.instances ?? {})) {
      if (!(c.requires ?? []).some((d) => d.id === s.component))
        gaps.push({ code: 'undeclared-component-dependency', id: s.component, requiredBy: id });
      walkToken(s.colorToken);
    }
    if (c.appearance)
      for (const p of Object.values(c.appearance.parts))
        for (const v of c.appearance.variants)
          for (const cell of Object.values(values(p, v.axes))) if (cell.token) walkToken(cell.token);
    componentActive.delete(id);
    componentSeen.add(id);
    componentOrder.push(id);
  };
  walkComponent(B.root);
  return { status: gaps.length ? 'blocked' : 'ready', gaps, tokenOrder, componentOrder };
}
export function resolved(B, id, seen = new Set()) {
  assert(!seen.has(id), 'token cycle');
  seen.add(id);
  const t = B.system.tokens[id];
  assert(t, 'missing token ' + id);
  return t.alias ? resolved(B, t.alias, seen) : t.value;
}
export function seal(B) {
  B.system.revision = hash({
    id: B.system.id,
    version: B.system.version,
    mode: B.system.mode,
    tokens: B.system.tokens,
    architecture: B.system.architecture,
  });
  for (const c of Object.values(B.components)) {
    const { revision, systemRef, ...definition } = c;
    c.revision = hash(definition);
    c.systemRef = { id: B.system.id, revision: B.system.revision };
  }
  return B;
}
