import React from 'react';
import { createRoot } from 'react-dom/client';
import { Snackbar } from '@mui/material';

import { ThemeProvider, createTheme } from '@mui/material/styles';
const __cssVarsTheme = createTheme({ cssVariables: true, colorSchemes: { light: true } });
import CssBaseline from '@mui/material/CssBaseline';

const CE = false;
const C = Snackbar;
const COMPONENTS = { Snackbar };
const EXTRA = {  };
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
const SPECS = [{"key":"","props":{"open":true,"message":"Snackbar message","autoHideDuration":null,"transitionDuration":0}}];
const CALLBACKS = ["onClose"];
const TEXT = "";
const CHILD_WRAP = null;
const CHILDREN_SPEC = null;
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
// ORGANISM round: childrenSpec RECURSES (see buildHarnessPage).
// COMPOSITION round: per-combo child props ride the root props under
// __dscChildProps and are merged onto the child of that importName (as the
// census page does — kept in lockstep).
function renderKidList(list, kid) {
  return list.map((cs, i) => React.createElement(
    COMPONENTS[cs.importName],
    { key: i, ...ceProps(resolveMarkers({ ...(cs.props || {}), ...((kid && kid[cs.importName]) || {}) })) },
    cs.children ? renderKidList(cs.children, kid) : cs.text,
  ));
}
function renderKids(kid) {
  if (CHILDREN_SPEC) return renderKidList(CHILDREN_SPEC, kid);
  if (CHILD_WRAP) { const W = COMPONENTS[CHILD_WRAP]; return <W>{TEXT}</W>; }
  // CARBON ROUND: "" = no children, not an empty-string child (see the census
  // page's renderKids above — Carbon's Checkbox forwards children onto a void
  // <input> and React throws). Kept in lockstep with the census page.
  return TEXT === '' ? undefined : TEXT;
}
const stageStyle = { display:'flex', alignItems:'flex-start', width:320, height:96, padding:16, boxSizing:'border-box', background:'#fff', overflow:'hidden' };
let specIdx = null;
let root = null;
function render() {
  let content = null;
  if (specIdx !== null) {
    const kid = SPECS[specIdx].props['__dscChildProps'];
    const props0 = resolveMarkers({ ...SPECS[specIdx].props });
    delete props0['__dscChildProps'];
    for (const cb of CALLBACKS) props0[cb] = () => {};
    const props = ceProps(props0);
    content = <C {...props}>{renderKids(kid)}</C>;
  }
  root.render(
    <ThemeProvider theme={__cssVarsTheme}><CssBaseline />
      <div id="depth-stage" style={stageStyle}>{content}</div>
    </ThemeProvider>
  );
}
// A CRASHED RENDER IS NOT A MEASUREMENT (Fluent round). React reports an
// uncaught render error through reportError, i.e. the window 'error' event —
// nothing in this harness listened, so a component whose render THREW looked
// exactly like a component that rendered and portaled nothing, and the sweep
// reported "0 portaled + 0 in-stage new roots" as if it were a finding.
// Measured on Fluent's Tooltip, whose trigger clone throws "A trigger element
// must be a single element for this component" when handed the ARRAY that
// childrenSpec always renders. Recording the errors here lets portalSweep
// refuse BY NAME with the library's own message instead of publishing a zero.
window.__renderErrors = [];
window.addEventListener('error', (e) => {
  const m = (e && e.error && e.error.message) || (e && e.message) || String(e);
  if (window.__renderErrors.indexOf(m) < 0) window.__renderErrors.push(m);
});
window.__setSpec = (v) => { specIdx = (v === false || v === null || v === undefined) ? null : (v === true ? 0 : v); render(); };
// TWO CHANNELS, BECAUSE THE CHEAP ONE IS CENSORED. The window 'error' listener
// above catches the reportError React uses for an uncaught render error, but
// the harness page is a file:// document loading a separate bundle, so the
// browser sanitizes the event to the bare string "Script error." — enough to
// REFUSE, not enough to say why. React's own onUncaughtError hands over the
// real Error object with the library's message intact ("A trigger element must
// be a single element for this component."), which is the part a reader needs.
// Recording only: neither channel changes a rendered pixel, and both committed
// portal corpora (mui/menu, mui/dialog) were re-run byte-identical with this in
// place. An older React that ignores the option degrades to the listener.
root = createRoot(document.getElementById('root'), {
  onUncaughtError: (error) => {
    const m = (error && error.message) || String(error);
    if (window.__renderErrors.indexOf(m) < 0) window.__renderErrors.push(m);
  },
});
window.__setSpec(false);
