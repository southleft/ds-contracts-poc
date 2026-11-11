// THE REACT TO FIGMA DRIVER: run this file in the target Figma file through the Desktop Bridge (figma_execute), with that
// file's tab in front, while scripts/react-to-figma-run.ts is serving. It decides nothing: it claims the one session,
// runs each program the runner serves (each starts with the file guard and sets every DS_ flag), and posts each return
// with its wall time, the time of an 8-step timer chain (a hidden tab runs about one step a minute) and the DS_ keys on
// globalThis before and after. A bridge time-out does not stop it; the runner's log shows its progress.
const BASE = 'http://localhost:9231';
const claim = await (await fetch(BASE + '/claim', { method: 'POST' })).json();
if (!claim.session) return claim;
const ds = () => Object.getOwnPropertyNames(globalThis).filter((k) => k.startsWith('DS_')).sort().map((k) => [k, String(globalThis[k])]);
for (;;) {
  const step = await (await fetch(BASE + '/next?session=' + claim.session)).json();
  if (step.done) return step;
  if (step.wait) { await new Promise((r) => setTimeout(r, 1000)); continue; }
  const t0 = Date.now();
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
  const out = { id: step.id, timerChainMs: Date.now() - t0, dsBefore: ds() }, start = Date.now();
  try { out.value = await (new Function('figma', 'return (async () => {\n' + step.program + '\n})()'))(figma); } catch (e) { out.error = String((e && e.message) || e); }
  out.ms = Date.now() - start; out.dsAfter = ds();
  await fetch(BASE + '/result?session=' + claim.session, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(out) });
}
