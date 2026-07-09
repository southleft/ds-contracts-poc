/**
 * Code import over the network — a public GitHub file OR directory URL →
 * the entry TSX plus its TRACED neighborhood (relative imports followed,
 * stylesheets attached), feeding the SAME lazy proposeFromCode path the
 * paste mode runs, as SourceFileInput[]. Browser-direct fetches only:
 * raw.githubusercontent.com for file bodies, api.github.com/repos/:o/:r/
 * contents/:path and /git/trees/:ref?recursive=1 (unauthenticated,
 * CORS-open for public repos) for listings. No token, no proxy.
 *
 * Deterministic first: the tracer parses the entry's relative import
 * statements (./ and ../ specifiers; .tsx/.ts/.css/.scss, extensionless
 * resolved through the .tsx → .ts → /index ladder) and fetches up to
 * MAX_TRACE_FILES referenced files, each fetch receipted. What it could NOT
 * close is a named GAP — the input for the assist fetch-plan rung, never a
 * silent fallback.
 *
 * Every failure is NAMED: 404 (with the private-repos-also-404 caveat),
 * rate limit (403/429 + x-ratelimit headers → reset time), file too large,
 * not-a-TSX. Discovery steps land in `notes` so the Receipts panel can show
 * exactly how each file was found — nothing silent.
 */
import type { SourceFileInput } from '../../../core/index.js';

const MAX_FILE_BYTES = 500 * 1024; // pasted-code parity; the compiler chunk is the heavy part, not the source

/** Referenced files fetched per trace (the entry itself is not counted). */
export const MAX_TRACE_FILES = 8;

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

/** Every relative specifier in the file's import/export statements —
 *  './Badge.module.css', '../hooks/useThing', "import './global.css'". */
export function relativeImportsOf(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/(?:import|export)\s[^'"]*?['"](\.{1,2}\/[^'"]+)['"]/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  // Side-effect imports: `import './x.css'`.
  for (const m of source.matchAll(/import\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
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

// ---------------------------------------------------------------------------
// The trace — entry + followed relative imports, as SourceFileInput[]
// ---------------------------------------------------------------------------

export interface GithubTrace {
  /** owner/repo/entryPath — provenance for the proposal. */
  sourcePath: string;
  parsed: ParsedGithubUrl;
  /** Repo-relative path of the entry TSX. */
  entryPath: string;
  /** Entry first; each file carries its own attached stylesheet text. */
  files: SourceFileInput[];
  /** Fetch/discovery receipts, one line per step — nothing silent. */
  notes: string[];
  /** What the deterministic tracer could NOT close, named — the input for
   *  the assist fetch-plan rung. */
  gaps: string[];
  /** Repo-relative paths fetched (entry included) — assist context. */
  alreadyFetched: string[];
}

const kb = (text: string) => `${Math.round(text.length / 102.4) / 10} KB`;

const STYLE_EXT = /\.(css|scss)$/;
const CODE_EXT = /\.(tsx|ts|jsx|js)$/;

/**
 * URL (file or directory) → the traced neighborhood.
 *
 * Directory URLs pick the entry from the contents listing: the file matching
 * the directory's name, else index.tsx's sole re-export target, else the
 * single candidate — multiple candidates without a name match stay a NAMED
 * error listing them.
 */
export async function traceFromGithubUrl(url: string, fetchImpl: FetchLike = fetch): Promise<GithubTrace> {
  const parsed = parseGithubUrl(url);
  const notes: string[] = [];
  const gaps: string[] = [];

  let entryPath = parsed.path;
  if (parsed.kind === 'dir') {
    const entries = await listDirectory(parsed, parsed.path, fetchImpl);
    const candidates = entries
      .filter((e) => e.type === 'file' && /\.(tsx|jsx)$/.test(e.name) && !/^index\.(tsx|jsx)$/.test(e.name))
      .filter((e) => !/\.(stories|test|spec)\.(tsx|jsx)$/.test(e.name))
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
    entryPath = [parsed.path, preferred ?? candidates[0]].filter(Boolean).join('/');
    notes.push(`Directory URL — picked ${basenameOf(entryPath)} from the GitHub contents listing.`);
  }

  const entryName = basenameOf(entryPath);
  if (!/\.(tsx|jsx)$/.test(entryName)) {
    throw new Error(`Not a TSX file: ${entryName} — the code importer reads React component source (.tsx/.jsx)`);
  }

  const entrySource = await fetchRaw(rawUrl(parsed, entryPath), fetchImpl);
  notes.push(`Fetched ${entryName} (${kb(entrySource)}) from ${rawUrl(parsed, entryPath)}`);

  const repoPrefix = `${parsed.owner}/${parsed.repo}/`;
  const files: SourceFileInput[] = [{ sourcePath: `${repoPrefix}${entryPath}`, source: entrySource }];
  const fetched = new Map<string, number>([[entryPath, 0]]); // path → files[] index
  const textByPath = new Map<string, string>([[entryPath, entrySource]]);
  const alreadyFetched = [entryPath];
  let budget = MAX_TRACE_FILES;

  /** Fetch one repo path within the budget; returns text or null. A quiet
   *  miss (extension-ladder probe, optional sibling) names nothing here —
   *  the caller names the whole unresolved import once. */
  const fetchTraced = async (path: string, why: string, quiet = false): Promise<string | null> => {
    if (budget <= 0) {
      gaps.push(`trace cap reached (${MAX_TRACE_FILES} referenced files) — ${path} not fetched (${why})`);
      return null;
    }
    try {
      const text = await fetchRaw(rawUrl(parsed, path), fetchImpl);
      budget--;
      alreadyFetched.push(path);
      textByPath.set(path, text);
      notes.push(`Traced ${why} → fetched ${path} (${kb(text)})`);
      return text;
    } catch (e) {
      if (!quiet) gaps.push(`${why}: fetch failed — ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };

  /** Attach stylesheet text to a traced file (concatenated when several). */
  const attachCss = (index: number, path: string, text: string) => {
    const file = files[index];
    const block = `/* --- ${path} --- */\n${text}`;
    file.css = file.css ? `${file.css}\n\n${block}` : block;
    if (path.endsWith('.scss')) {
      gaps.push(
        `${path} is SCSS — the CSS-Module anatomy reader parses what it can; SCSS-only syntax (nesting, variables, mixins) degrades by name in the proposal notes`,
      );
    } else if (!path.endsWith('.module.css')) {
      notes.push(
        `${path} is plain CSS, not a CSS Module — anatomy extraction degrades by name, exactly like the foreign-css fixture.`,
      );
    }
  };

  // One hop from the entry: follow its relative imports; every traced TSX/TS
  // file additionally gets its OWN stylesheet imports attached.
  const codeQueue: number[] = [0];
  const seenSpecifiers = new Set<string>();
  while (codeQueue.length > 0) {
    const index = codeQueue.shift()!;
    const fromEntry = index === 0;
    const fileDir = dirnameOf(files[index].sourcePath.slice(repoPrefix.length));
    for (const spec of relativeImportsOf(files[index].source)) {
      const key = `${fileDir}|${spec}`;
      if (seenSpecifiers.has(key)) continue;
      seenSpecifiers.add(key);
      const resolved = resolveRelative(fileDir, spec);
      if (STYLE_EXT.test(spec)) {
        if (fetched.has(resolved)) continue;
        const text = await fetchTraced(resolved, `import '${spec}'`);
        if (text !== null) {
          fetched.set(resolved, index);
          attachCss(index, resolved, text);
        }
        continue;
      }
      // Code imports are followed from the ENTRY only (one hop, by design);
      // deeper levels would trade receipts for guesswork.
      if (!fromEntry) continue;
      if (CODE_EXT.test(spec)) {
        if (fetched.has(resolved)) continue;
        const text = await fetchTraced(resolved, `import '${spec}'`);
        if (text !== null) {
          fetched.set(resolved, files.length);
          files.push({ sourcePath: `${repoPrefix}${resolved}`, source: text });
          codeQueue.push(files.length - 1);
        }
        continue;
      }
      if (/\.[a-z0-9]+$/i.test(spec)) {
        notes.push(`import '${spec}' skipped — not a .tsx/.ts/.css/.scss source (assets stay where they are)`);
        continue;
      }
      // Extensionless: the .tsx → .ts → /index.tsx → /index.ts ladder.
      const candidates = [`${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.tsx`, `${resolved}/index.ts`];
      let hit = false;
      for (const candidate of candidates) {
        if (fetched.has(candidate)) { hit = true; break; }
        const text = await fetchTraced(candidate, `import '${spec}'`, true);
        if (text !== null) {
          fetched.set(candidate, files.length);
          files.push({ sourcePath: `${repoPrefix}${candidate}`, source: text });
          codeQueue.push(files.length - 1);
          hit = true;
          break;
        }
        if (budget <= 0) break;
      }
      if (!hit && budget > 0) {
        gaps.push(`import '${spec}' unresolved — tried ${candidates.map(basenameOf).join(', ')}`);
      }
    }
  }

  // Entry still styleless? The classic discovery ladder, receipted.
  if (!files[0].css) {
    const dir = dirnameOf(entryPath);
    const sibling = entryName.replace(/\.(tsx|jsx)$/, '.module.css');
    const siblingPath = [dir, sibling].filter(Boolean).join('/');
    const siblingText = await fetchTraced(siblingPath, `same-name sibling ${sibling}`, true);
    if (siblingText !== null) {
      attachCss(0, siblingPath, siblingText);
    } else {
      try {
        const entries = await listDirectory(parsed, dir, fetchImpl);
        const moduleCss = entries.find((e) => e.type === 'file' && e.name.endsWith('.module.css'));
        if (moduleCss) {
          const p = [dir, moduleCss.name].filter(Boolean).join('/');
          const known = textByPath.get(p);
          if (known !== undefined) {
            notes.push(`Directory listing → ${moduleCss.name} — already traced, attached to the entry too`);
            attachCss(0, p, known);
          } else {
            const text = await fetchTraced(p, `directory listing → ${moduleCss.name}`);
            if (text !== null) attachCss(0, p, text);
          }
        }
      } catch (e) {
        notes.push(`Directory listing for stylesheet discovery failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  if (!files[0].css) {
    gaps.push(
      `no stylesheet reached ${entryName} — the proposal reads the props surface only (no anatomy); the styling source may live outside import-following (theme file, tailwind config, global stylesheet)`,
    );
  }

  return {
    sourcePath: `${repoPrefix}${entryPath}`,
    parsed,
    entryPath,
    files,
    notes,
    gaps,
    alreadyFetched,
  };
}

// ---------------------------------------------------------------------------
// Repo-level context for the assist rungs
// ---------------------------------------------------------------------------

export interface RepoTreeEntry {
  path: string;
  size?: number;
}

/** The repo's full file listing via the git trees API (one CORS-open call).
 *  Capped at 2000 entries for the assist payload — entries nearest the entry
 *  file sort first so the cap cuts the far side. */
export async function fetchRepoTree(
  parsed: ParsedGithubUrl,
  nearPath: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ listing: RepoTreeEntry[]; truncated: boolean }> {
  const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(parsed.ref)}?recursive=1`;
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { Accept: 'application/vnd.github+json' } });
  } catch (e) {
    throw new Error(`Network error fetching ${url} — ${e instanceof Error ? e.message : String(e)}`);
  }
  const rateLimited = rateLimitError(res, url);
  if (rateLimited) throw rateLimited;
  if (!res.ok) throw new Error(`GitHub trees API answered ${res.status} for ${url}`);
  const body = (await res.json()) as { tree?: Array<{ path?: string; type?: string; size?: number }>; truncated?: boolean };
  const blobs = (body.tree ?? []).filter((e) => e.type === 'blob' && typeof e.path === 'string');
  const nearDir = dirnameOf(nearPath);
  const rank = (p: string) => (nearDir && p.startsWith(`${nearDir}/`) ? 0 : p.startsWith('src/') ? 1 : 2);
  const sorted = blobs
    .map((e) => ({ path: e.path!, ...(typeof e.size === 'number' ? { size: e.size } : {}) }))
    .sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
  return {
    listing: sorted.slice(0, 2000),
    truncated: Boolean(body.truncated) || sorted.length > 2000,
  };
}

/** One raw file body (assist repo-profile samples); errors stay named. */
export function fetchRepoFile(
  parsed: ParsedGithubUrl,
  path: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  return fetchRaw(rawUrl(parsed, path), fetchImpl);
}
