import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Browser, Page } from 'playwright-core';
import { checkSource, type SourceProfile } from './check.js';
import { observeSource, watchSourceFailures } from './observe.js';

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** HAR keeps the actual loaded resources, including fonts and Vite transforms.
 * It is private evidence: URLs may contain local filesystem paths. Never publish
 * a HAR without a separate credential/private-data review. No network fallback.
 */
export async function captureReference(page: Page, profile: SourceProfile,
  failures: ReturnType<typeof watchSourceFailures>, quietMs = 500) {
  let readinessError = false;
  try {
    await page.waitForLoadState('networkidle', {timeout:15000});
    await page.waitForFunction(() => document.fonts.status === 'loaded', undefined, {timeout:10000});
  } catch { readinessError = true; }
  const before = await observeSource(page, profile, failures);
  const first = await page.screenshot({fullPage:true});
  await page.waitForTimeout(quietMs);
  const second = await page.screenshot({fullPage:true});
  const after = await observeSource(page, profile, failures);
  const verdict = checkSource(profile, after);
  const problems = [...new Set([...checkSource(profile,before).problems, ...verdict.problems])];
  if (readinessError) problems.push('readiness-timeout');
  if (!first.equals(second)) problems.push('render-not-stable');
  if (JSON.stringify(before) !== JSON.stringify(after)) problems.push('source-witness-not-stable');
  return {status:problems.length ? 'invalid' as const : 'valid' as const, problems,
    before, after, firstSha256:sha(first), secondSha256:sha(second), screenshot:second};
}

export async function replayReference<Inspection = undefined>(browser: Browser, har: string, url: string, profile: SourceProfile,
  viewport = {width:900,height:600}, inspect?: (page:Page, failures:ReturnType<typeof watchSourceFailures>) => Promise<Inspection>) {
  // A fresh context isolates cookies, browser cache, fonts and service workers.
  const context = await browser.newContext({viewport, deviceScaleFactor:1, colorScheme:'dark', serviceWorkers:'block'});
  await context.routeFromHAR(har, {notFound:'abort', update:false});
  await context.routeWebSocket('**/*', socket => socket.close());
  const page = await context.newPage();
  const failures = watchSourceFailures(page);
  try {
    await page.goto(url, {waitUntil:'load', timeout:30000});
    const reference = await captureReference(page, profile, failures);
    const inspection = inspect && reference.status === 'valid' ? await inspect(page,failures) : undefined;
    return {...reference,inspection};
  } finally { failures.dispose(); await context.close(); }
}

/** Inventory the evidence actually recorded, not just a hash of the entry HTML. */
export function archiveInventory(file: string) {
  const bytes = readFileSync(file);
  const har = JSON.parse(bytes.toString('utf8'));
  const entries = har.log.entries as {request:{method:string;url:string};response:{status:number;content:{text?:string;encoding?:string}}}[];
  return {sha256:sha(bytes), entries:entries.map(entry => {
    const content = entry.response.content;
    const body = content.text === undefined ? null : Buffer.from(content.text, content.encoding === 'base64' ? 'base64' : 'utf8');
    return {method:entry.request.method, urlSha256:sha(Buffer.from(entry.request.url)), status:entry.response.status,
      bodySha256:body === null ? null : sha(body), bytes:body?.length ?? 0};
  })};
}
