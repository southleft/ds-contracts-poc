/**
 * Code import over the network — a public GitHub file URL → the TSX (+ the
 * co-located stylesheet, auto-discovered) that feeds the SAME lazy
 * proposeFromCode path the paste mode runs. Browser-direct fetches only:
 * raw.githubusercontent.com for file bodies, api.github.com/repos/:o/:r/
 * contents/:path (unauthenticated, CORS-open for public repos) for directory
 * listings. No token, no proxy, session-only like everything else here.
 *
 * Every failure is NAMED: 404 (with the private-repos-also-404 caveat),
 * rate limit (403/429 + x-ratelimit headers → reset time), file too large,
 * not-a-TSX. Discovery steps land in `notes` so the Receipts panel can show
 * how the stylesheet was (or wasn't) found — nothing silent.
 */

const MAX_FILE_BYTES = 500 * 1024; // pasted-code parity; the compiler chunk is the heavy part, not the source

export interface GithubImport {
  /** owner/repo/path — provenance for the proposal. */
  sourcePath: string;
  tsx: string;
  tsxName: string;
  /** Co-located stylesheet text ('' when none was found). */
  css: string;
  cssName: string | null;
  /** Discovery receipts: which URLs answered, how the stylesheet was found. */
  notes: string[];
}

interface ParsedGithubUrl {
  owner: string;
  repo: string;
  ref: string;
  /** Path inside the repo ('' for the repo root). */
  path: string;
  kind: 'file' | 'dir';
}

/**
 * Accepts the github.com URL forms that carry a file or directory:
 *   https://github.com/:owner/:repo/blob/:ref/:path   (file)
 *   https://github.com/:owner/:repo/raw/:ref/:path    (file)
 *   https://github.com/:owner/:repo/tree/:ref/:path   (directory)
 *   https://raw.githubusercontent.com/:owner/:repo/:ref/:path (file, as-is)
 */
export function parseGithubUrl(url: string): ParsedGithubUrl {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new Error(`Not a URL: ${url}`);
  }
  const segments = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (u.hostname === 'raw.githubusercontent.com') {
    if (segments.length < 4) {
      throw new Error(
        `Unrecognized raw.githubusercontent.com URL shape "/${segments.join('/')}" — expected /:owner/:repo/:ref/:path`,
      );
    }
    // "refs/heads/<branch>" is the copy-button form; fold it into the ref.
    const refLen = segments[2] === 'refs' && (segments[3] === 'heads' || segments[3] === 'tags') ? 3 : 1;
    return {
      owner: segments[0],
      repo: segments[1],
      ref: segments.slice(2, 2 + refLen).join('/'),
      path: segments.slice(2 + refLen).join('/'),
      kind: 'file',
    };
  }
  if (!/(^|\.)github\.com$/.test(u.hostname)) {
    throw new Error(`Not a github.com URL: ${u.hostname}`);
  }
  const [owner, repo, verb, ref, ...rest] = segments;
  if (!owner || !repo || !verb || !ref || !['blob', 'raw', 'tree'].includes(verb)) {
    throw new Error(
      `Unrecognized github.com URL shape "/${segments.join('/')}" — expected /:owner/:repo/blob/:ref/:path (file) or /:owner/:repo/tree/:ref/:path (directory)`,
    );
  }
  return {
    owner,
    repo,
    ref,
    path: rest.join('/'),
    kind: verb === 'tree' ? 'dir' : 'file',
  };
}

const rawUrl = (p: ParsedGithubUrl, path: string) =>
  `https://raw.githubusercontent.com/${p.owner}/${p.repo}/${p.ref}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

const apiContentsUrl = (p: ParsedGithubUrl, dirPath: string) =>
  `https://api.github.com/repos/${p.owner}/${p.repo}/contents/${dirPath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')}?ref=${encodeURIComponent(p.ref)}`;

export type FetchLike = typeof fetch;

/** Name the rate-limit condition precisely when GitHub's headers say so. */
function rateLimitError(res: Response, url: string): Error | null {
  if (res.status !== 403 && res.status !== 429) return null;
  if (res.headers.get('x-ratelimit-remaining') !== '0') return null;
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  const when = Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toLocaleTimeString() : 'soon';
  return new Error(
    `GitHub API rate limit exceeded (unauthenticated calls are limited per IP) — resets at ${when}. ${url}`,
  );
}

async function fetchRaw(url: string, fetchImpl: FetchLike): Promise<string> {
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch (e) {
    throw new Error(`Network error fetching ${url} — ${e instanceof Error ? e.message : String(e)}`);
  }
  if (res.status === 404) {
    throw new Error(
      `404 — no file at ${url}. GitHub answers 404 for private and non-existent repos alike, so check that the repo is public and the branch/path are right.`,
    );
  }
  const rateLimited = rateLimitError(res, url);
  if (rateLimited) throw rateLimited;
  if (res.status === 403) throw new Error(`403 — access denied for ${url} (not a public repo?)`);
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${url}`);
  const size = Number(res.headers.get('content-length'));
  if (Number.isFinite(size) && size > MAX_FILE_BYTES) {
    throw new Error(`File too large: ${Math.round(size / 1024)} KB exceeds the ${MAX_FILE_BYTES / 1024} KB import limit — ${url}`);
  }
  const text = await res.text();
  if (text.length > MAX_FILE_BYTES) {
    throw new Error(
      `File too large: ${Math.round(text.length / 1024)} KB exceeds the ${MAX_FILE_BYTES / 1024} KB import limit — ${url}`,
    );
  }
  return text;
}

interface DirEntry {
  name: string;
  type: string;
}

async function listDirectory(p: ParsedGithubUrl, dirPath: string, fetchImpl: FetchLike): Promise<DirEntry[]> {
  const url = apiContentsUrl(p, dirPath);
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { Accept: 'application/vnd.github+json' } });
  } catch (e) {
    throw new Error(`Network error fetching ${url} — ${e instanceof Error ? e.message : String(e)}`);
  }
  if (res.status === 404) {
    throw new Error(
      `404 — GitHub's contents API has no ${dirPath || '(repo root)'} in ${p.owner}/${p.repo}@${p.ref}. Private repos also answer 404 here — the unauthenticated API only sees public repos.`,
    );
  }
  const rateLimited = rateLimitError(res, url);
  if (rateLimited) throw rateLimited;
  if (res.status === 403) throw new Error(`403 — access denied for ${url} (not a public repo?)`);
  if (!res.ok) throw new Error(`GitHub API answered ${res.status} for ${url}`);
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) throw new Error(`${url} is a file, not a directory listing`);
  return body as DirEntry[];
}

const dirnameOf = (path: string) => path.split('/').slice(0, -1).join('/');
const basenameOf = (path: string) => path.split('/').pop() ?? path;

/** Relative CSS specifiers imported by the TSX ('./Badge.module.css', '../x.css'). */
export function cssImportsOf(tsx: string): string[] {
  const out: string[] = [];
  for (const m of tsx.matchAll(/import\s+(?:[\w$]+\s+from\s+)?['"](\.{1,2}\/[^'"]+\.css)['"]/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/** Resolve './x.css' / '../y/x.css' against the importing file's directory. */
function resolveRelative(dir: string, specifier: string): string {
  const parts = dir ? dir.split('/') : [];
  for (const seg of specifier.split('/')) {
    if (seg === '.' || seg === '') continue;
    else if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

/**
 * The whole import: URL → TSX text + auto-discovered co-located stylesheet.
 * Discovery ladder (each step reported in notes):
 *   1. the stylesheet the TSX itself imports (module or plain CSS — plain CSS
 *      degrades downstream exactly like the foreign-css fixture),
 *   2. the same-name sibling <Component>.module.css,
 *   3. any *.module.css in the directory listing (API call — only when needed).
 */
export async function importFromGithubUrl(url: string, fetchImpl: FetchLike = fetch): Promise<GithubImport> {
  const parsed = parseGithubUrl(url);
  const notes: string[] = [];

  let tsxPath = parsed.path;
  if (parsed.kind === 'dir') {
    const entries = await listDirectory(parsed, parsed.path, fetchImpl);
    const candidates = entries
      .filter((e) => e.type === 'file' && /\.(tsx|jsx)$/.test(e.name) && !/^index\.(tsx|jsx)$/.test(e.name))
      .map((e) => e.name);
    if (candidates.length === 0) {
      throw new Error(`No .tsx/.jsx file in ${parsed.owner}/${parsed.repo}/${parsed.path || '(root)'}@${parsed.ref}`);
    }
    const dirName = basenameOf(parsed.path);
    const preferred = candidates.find((n) => n.replace(/\.(tsx|jsx)$/, '') === dirName);
    if (!preferred && candidates.length > 1) {
      throw new Error(
        `Multiple components in ${parsed.path || '(root)'} — pick one file URL: ${candidates.join(', ')}`,
      );
    }
    tsxPath = [parsed.path, preferred ?? candidates[0]].filter(Boolean).join('/');
    notes.push(`Directory URL — picked ${basenameOf(tsxPath)} from the GitHub contents listing.`);
  }

  const tsxName = basenameOf(tsxPath);
  if (!/\.(tsx|jsx)$/.test(tsxName)) {
    throw new Error(`Not a TSX file: ${tsxName} — the code importer reads React component source (.tsx/.jsx)`);
  }

  const tsxRawUrl = rawUrl(parsed, tsxPath);
  const tsx = await fetchRaw(tsxRawUrl, fetchImpl);
  notes.push(`Fetched ${tsxName} (${Math.round(tsx.length / 102.4) / 10} KB) from ${tsxRawUrl}`);

  const dir = dirnameOf(tsxPath);
  let css = '';
  let cssName: string | null = null;

  // 1 — the stylesheet the component itself imports.
  const imported = cssImportsOf(tsx);
  if (imported.length > 0) {
    const cssPath = resolveRelative(dir, imported[0]);
    try {
      css = await fetchRaw(rawUrl(parsed, cssPath), fetchImpl);
      cssName = basenameOf(cssPath);
      notes.push(`Stylesheet auto-discovered from the component's own import: ${imported[0]} → ${cssName}`);
      if (!/\.module\.css$/.test(cssName)) {
        notes.push(`${cssName} is plain CSS, not a CSS Module — anatomy extraction degrades by name, exactly like the foreign-css fixture.`);
      }
    } catch (e) {
      notes.push(`The component imports ${imported[0]} but the sibling fetch failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2 — same-name sibling <Component>.module.css.
  if (!cssName) {
    const sibling = tsxName.replace(/\.(tsx|jsx)$/, '.module.css');
    const siblingPath = [dir, sibling].filter(Boolean).join('/');
    try {
      css = await fetchRaw(rawUrl(parsed, siblingPath), fetchImpl);
      cssName = sibling;
      notes.push(`Stylesheet auto-discovered as the same-name sibling: ${sibling}`);
    } catch {
      /* fall through to the directory listing */
    }
  }

  // 3 — any *.module.css in the directory (one API call, only when needed).
  if (!cssName) {
    try {
      const entries = await listDirectory(parsed, dir, fetchImpl);
      const moduleCss = entries.find((e) => e.type === 'file' && e.name.endsWith('.module.css'));
      if (moduleCss) {
        css = await fetchRaw(rawUrl(parsed, [dir, moduleCss.name].filter(Boolean).join('/')), fetchImpl);
        cssName = moduleCss.name;
        notes.push(`Stylesheet auto-discovered from the directory listing: ${moduleCss.name}`);
      }
    } catch (e) {
      notes.push(`Directory listing for stylesheet discovery failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!cssName) {
    notes.push('No co-located stylesheet found — the proposal reads the props surface only (no anatomy).');
  }

  return {
    sourcePath: `${parsed.owner}/${parsed.repo}/${tsxPath}`,
    tsx,
    tsxName,
    css,
    cssName,
    notes,
  };
}
