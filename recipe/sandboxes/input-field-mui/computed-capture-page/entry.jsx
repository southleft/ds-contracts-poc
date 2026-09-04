import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Link } from '@mui/material';

import { ThemeProvider, createTheme } from '@mui/material/styles';
const __cssVarsTheme = createTheme({ cssVariables: true, colorSchemes: { light: true } });
import CssBaseline from '@mui/material/CssBaseline';

const CE = false;
const COMPONENTS = { Link };
const EXTRA = {  };
// CUSTOM-ELEMENT PROP SEMANTICS (React 18 sets unknown props as ATTRIBUTES):
//   · `false` must be OMITTED — Lit's `type: Boolean` converter reads
//     ATTRIBUTE PRESENCE, so isDisabled="false" is TRUE. This is the same
//     "absent ≠ falsy" rule the unset pseudo-value already encodes for
//     defaultless enums, applied to booleans.
//   · function values are dropped — React 18 does not attach listeners to
//     custom elements and would try to stringify the function into an
//     attribute. Custom elements take events, not callback props.
const ceProps = (p) => {
  if (!CE) return p;
  const o = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (v === false || v === undefined || v === null || typeof v === 'function') continue;
    o[k] = v;
  }
  return o;
};
const SPECS = [{"key":"Link:primary.none","component":"Link","props":{"href":"#mui-link","color":"primary","underline":"none"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:primary.hover","component":"Link","props":{"href":"#mui-link","color":"primary","underline":"hover"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:primary.always","component":"Link","props":{"href":"#mui-link","color":"primary","underline":"always"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:secondary.none","component":"Link","props":{"href":"#mui-link","color":"secondary","underline":"none"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:secondary.hover","component":"Link","props":{"href":"#mui-link","color":"secondary","underline":"hover"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:secondary.always","component":"Link","props":{"href":"#mui-link","color":"secondary","underline":"always"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:error.none","component":"Link","props":{"href":"#mui-link","color":"error","underline":"none"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:error.hover","component":"Link","props":{"href":"#mui-link","color":"error","underline":"hover"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:error.always","component":"Link","props":{"href":"#mui-link","color":"error","underline":"always"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:info.none","component":"Link","props":{"href":"#mui-link","color":"info","underline":"none"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:info.hover","component":"Link","props":{"href":"#mui-link","color":"info","underline":"hover"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:info.always","component":"Link","props":{"href":"#mui-link","color":"info","underline":"always"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:success.none","component":"Link","props":{"href":"#mui-link","color":"success","underline":"none"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:success.hover","component":"Link","props":{"href":"#mui-link","color":"success","underline":"hover"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:success.always","component":"Link","props":{"href":"#mui-link","color":"success","underline":"always"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:warning.none","component":"Link","props":{"href":"#mui-link","color":"warning","underline":"none"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:warning.hover","component":"Link","props":{"href":"#mui-link","color":"warning","underline":"hover"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:warning.always","component":"Link","props":{"href":"#mui-link","color":"warning","underline":"always"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:inherit.none","component":"Link","props":{"href":"#mui-link","color":"inherit","underline":"none"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:inherit.hover","component":"Link","props":{"href":"#mui-link","color":"inherit","underline":"hover"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}},{"key":"Link:inherit.always","component":"Link","props":{"href":"#mui-link","color":"inherit","underline":"always"},"callbacks":[],"text":"Link","stage":{"width":320,"height":96,"padding":16}}];
const stageStyle = (st, block) => ({ display: block ? 'block' : 'flex', ...(block ? {} : { alignItems: 'flex-start' }), width: st.width, height: st.height, padding: st.padding, boxSizing: 'border-box', background: '#fff', overflow: 'hidden' });
const stage = stageStyle({ width: 320, height: 96, padding: 16 });

// presence-value marker grammar: {"$callback":true} → () => {};
// {"$date":"<iso>"} → new Date("<iso>") — a PINNED literal, never a clock read;
// {"$import":"pkg#Name"} → the imported binding (resolved recursively);
// {"$render":"pkg#Name"} → (params) => <Name {...params} /> — the identity
// render-prop; {"$element":"pkg#Name","props":{},"text":"..."} → a bounded
// React element for element-valued props (for example input adornments).
function resolveMarkers(v) {
  if (v && typeof v === 'object') {
    if (v.$callback === true) return () => {};
    if (typeof v.$date === 'string') return new Date(v.$date);
    if (typeof v.$import === 'string') return EXTRA[v.$import.split('#')[1]];
    if (typeof v.$render === 'string') { const K = EXTRA[v.$render.split('#')[1]]; return (params) => React.createElement(K, params); }
    if (typeof v.$element === 'string') {
      const K = EXTRA[v.$element.split('#')[1]];
      return React.createElement(K, resolveMarkers(v.props || {}), v.text == null ? undefined : String(v.text));
    }
    if (Array.isArray(v)) return v.map(resolveMarkers);
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = resolveMarkers(x);
    return out;
  }
  return v;
}

// MOLECULE round: canonical children — childWrap (one wrapped text child),
// childrenSpec (N imported children), or bare sampleText.
// ORGANISM round: childrenSpec RECURSES — a node with .children mounts its
// own child list instead of text (mutually exclusive, refused at load).
// COMPOSITION round: per-combo child props ({"$childProps"} on an axis value)
// ride the root props under CHILD_PROPS_KEY and are merged here onto the
// childrenSpec child of that importName, at any depth, over its static props.
function renderKidList(list, kid) {
  return list.map((cs, i) => React.createElement(
    COMPONENTS[cs.importName],
    { key: i, ...ceProps(resolveMarkers({ ...(cs.props || {}), ...((kid && kid[cs.importName]) || {}) })) },
    cs.children ? renderKidList(cs.children, kid) : cs.text,
  ));
}
function renderKids(s, kid) {
  if (s.childrenSpec) return renderKidList(s.childrenSpec, kid);
  if (s.childWrap) { const W = COMPONENTS[s.childWrap]; return <W>{s.text}</W>; }
  // CARBON ROUND: sampleText "" means the component takes NO sample text, and
  // React does not treat that the same as an empty string — '' is a REAL child.
  // Carbon's Checkbox forwards its rest props (children included) straight onto
  // an <input>, and React refuses children on a void element: the whole tree
  // threw and the harness page rendered NOTHING (waitForSelector timeout, no
  // mention of children anywhere). Six libraries tolerated the empty child by
  // accident; one library that forwards children to a void element cannot.
  // Byte-identity for the tolerant libraries is PROVEN, not assumed — see
  // examples/carbon/PROVENANCE.md (tailwind ToggleSwitch + mui Switch
  // re-captured under this change: captured-truth.json byte-identical).
  return s.text === '' ? undefined : s.text;
}

function App({ gen, comboGen }) {
  return (
    <ThemeProvider theme={__cssVarsTheme}><CssBaseline />
      {SPECS.map((s) => {
        const C = COMPONENTS[s.component];
        const kid = s.props['__dscChildProps'];
        const props0 = resolveMarkers({ ...s.props });
        delete props0['__dscChildProps'];
        for (const cb of s.callbacks) props0[cb] = () => {};
        const props = ceProps(props0);
        return (
          <React.Fragment key={s.key + ':' + gen + ':' + (comboGen[s.key] || 0)}>
            <button data-sentinel={s.key} style={{ width: 8, height: 8, padding: 0, border: 0, margin: 2, background: '#eee' }} aria-label="sentinel" />
            <div data-combo={s.key} style={stageStyle(s.stage, s.blockStage)}><C {...props}>{renderKids(s, kid)}</C></div>
          </React.Fragment>
        );
      })}
      <div data-combo="__control-button" style={stage}><button>SAMPLE</button></div>
      <div data-combo="__control-span" style={stage}><span>SAMPLE</span></div>
      <div data-combo="__control-a" style={stage}><a href="#c">SAMPLE</a></div>
      <div data-combo="__control-div" style={stage}><div>SAMPLE</div></div>
    </ThemeProvider>
  );
}
const root = createRoot(document.getElementById('root'));
let mountGen = 0;
const comboGen = {};
function paint() { root.render(<App gen={mountGen} comboGen={{ ...comboGen }} />); }
// REACT-STATE REMOUNT — click-mutated library state (a calendar's selected
// day, an uncontrolled tab) is not an <input checked> and formStateReset
// cannot see it. A key bump remounts that combo from its original props.
// Optional key remounts ONE combo (the sweep's current subject) so a
// 50-combo census page does not rebuild every sibling on every plane.
// flushSync so the next capture reads the new tree. See remountHarness().
window.__DSC_REMOUNT = (key) => {
  if (typeof key === 'string' && key) comboGen[key] = (comboGen[key] || 0) + 1;
  else mountGen += 1;
  flushSync(paint);
};
paint();
