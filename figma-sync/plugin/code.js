// DS Contracts Sync Runner — runs the generated figma-sync scripts from the
// local server (npm run figma:serve), in order, in the CURRENT file.
// This is the from-disk transport for full-library operations (fresh-file
// rebuild, big re-syncs) — no copy/paste, no per-script size caps.
const BASE = 'http://127.0.0.1:8765';

async function main() {
  figma.notify('Sync Runner: fetching script list…');
  const list = await (await fetch(BASE + '/runner-manifest.json')).json();
  const results = [];
  for (const name of list.scripts) {
    figma.notify('Running ' + name + '…', { timeout: 1500 });
    const code = await (await fetch(BASE + '/' + name)).text();
    try {
      const result = await new Function('return (async () => {\n' + code + '\n})()')();
      results.push({ script: name, ok: true, result });
    } catch (e) {
      results.push({ script: name, ok: false, error: String(e && e.message ? e.message : e) });
      break; // dependency order matters — stop on first failure
    }
  }
  // Report back to the local server so the agent/CI can read the outcome.
  try {
    await fetch(BASE + '/runner-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileKey: figma.fileKey || null, when: Date.now(), results }, null, 2),
    });
  } catch (e) { /* server may not accept POST; the summary below still shows */ }
  const failed = results.filter((r) => !r.ok);
  figma.closePlugin(failed.length === 0
    ? 'Sync complete: ' + results.length + ' script(s) ran clean.'
    : 'FAILED at ' + failed[0].script + ': ' + failed[0].error);
}
main();
