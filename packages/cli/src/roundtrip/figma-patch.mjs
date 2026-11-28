export async function patchNative(context) {
  const { R, figma, B, parent, vars, collections, components, stable, rgb, shot, before: initial, tokenValue } = context;
  let before = initial;
  const intended = JSON.parse(JSON.stringify(R.expected)),
    color = (id) =>
      B.system.tokens[id].alias
        ? color(B.system.tokens[id].alias)
        : tokenValue(B.system.tokens[id].type, B.system.tokens[id].value);
  for (const [id, t] of Object.entries(B.system.tokens)) {
    delete intended.tokens[id].alias;
    delete intended.tokens[id].value;
    Object.assign(intended.tokens[id], t.alias ? { alias: t.alias } : { value: t.value });
  }
  for (const [id, c] of Object.entries(intended.components)) c.revision = B.components[id].revision;
  for (const v of intended.variants) {
    for (const p of Object.values(v.parts))
      for (const [field, id] of Object.entries(p.tokens)) p.styles[field] = color(id);
    for (const [slot, d] of Object.entries(v.instances)) {
      d.revision = B.components[parent.instances[slot].component].revision;
      for (const vector of d.vectors) vector.color = color(d.colorToken);
    }
  }
  if (stable(before) === stable(intended)) return { status: "unchanged", created: 0, snapshot: before };
  if (stable(before) !== stable(R.expected)) {
    before = await shot(R.expected.tokens);
    if (stable(before) !== stable(R.expected)) throw Error("native revision conflict");
  }
  const undo = [];
  try {
    for (const id of R.plan.tokenOrder) {
      const t = B.system.tokens[id],
        v = vars[id],
        mode = collections[t.tier].defaultModeId,
        old = v.valuesByMode[mode],
        next = t.alias
          ? figma.variables.createVariableAlias(vars[t.alias])
          : t.type === "dimension"
            ? tokenValue(t.type, t.value, "native")
            : rgb(tokenValue(t.type, t.value));
      undo.push(() => {
        const current = v.valuesByMode[mode];
        if (typeof next === "number" ? current === next : stable(current) === stable(next)) v.setValueForMode(mode, old);
      });
      v.setValueForMode(mode, next);
    }
    for (const [id, n] of Object.entries(components)) {
      const old = n.getSharedPluginData("ds_contracts_roundtrip_v1", "contract-revision"),
        next = B.components[id].revision;
      undo.push(() => {
        if (n.getSharedPluginData("ds_contracts_roundtrip_v1", "contract-revision") === next)
          n.setSharedPluginData("ds_contracts_roundtrip_v1", "contract-revision", old);
      });
      n.setSharedPluginData("ds_contracts_roundtrip_v1", "contract-revision", next);
    }
    const after = await shot();
    if (stable(after) !== stable(intended)) throw Error("native patch result differs");
    return { status: "patched", created: 0, before, after };
  } catch (error) {
    const failures = [];
    for (const restore of undo.reverse())
      try {
        restore();
      } catch (e) {
        failures.push(e.message);
      }
    if (failures.length) throw Error(error.message + "; rollback incomplete: " + failures.join("; "));
    throw error;
  }
}
