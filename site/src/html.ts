/**
 * Shared HTML rendering for the spec site — layout shell, nav, footer,
 * build-time syntax highlighting (Prism runs here, at build; the shipped
 * pages carry zero highlighting JS).
 */
import { execSync } from 'node:child_process';
import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/index.js';

loadLanguages(['json', 'jsx', 'tsx', 'typescript', 'bash']);

export const esc = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Build-time syntax highlighting. `lang` must be loaded above. */
export function hl(code: string, lang: 'json' | 'jsonc' | 'tsx' | 'ts' | 'bash' | 'text'): string {
  if (lang === 'text') return esc(code);
  const grammarName = lang === 'jsonc' ? 'json' : lang === 'ts' ? 'typescript' : lang;
  const grammar = Prism.languages[grammarName];
  if (!grammar) return esc(code);
  return Prism.highlight(code, grammar, grammarName);
}

/** A highlighted code block with an optional provenance caption. */
export function codeBlock(
  code: string,
  lang: 'json' | 'jsonc' | 'tsx' | 'ts' | 'bash' | 'text',
  caption?: string,
): string {
  const cap = caption ? `<figcaption class="code-caption">${caption}</figcaption>` : '';
  return `<figure class="code-figure">${cap}<pre class="code-block" data-lang="${lang}"><code>${hl(code.trimEnd(), lang)}</code></pre></figure>`;
}

/** Honesty badges — every spec-page section declares where it came from. */
export type Provenance = 'generated' | 'curated' | 'example';
export function badge(kind: Provenance, title?: string): string {
  const label = { generated: 'Generated', curated: 'Curated', example: 'Example' }[kind];
  const titles: Record<Provenance, string> = {
    generated: 'Rendered from scripts/contract-schema.ts by Zod introspection at build time — cannot drift from the schema.',
    curated: 'Hand-written summary, kept honest by the coverage guard and review — not machine-derived.',
    example: 'Loaded from a real file in this repository at build time.',
  };
  return `<span class="badge badge--${kind}" title="${esc(title ?? titles[kind])}">${label}</span>`;
}

export interface NavItem {
  label: string;
  href: string;
  /** Path prefix that marks this item active. */
  match: string;
}

const NAV: NavItem[] = [
  { label: 'Spec', href: '/spec/', match: '/spec' },
  { label: 'How it works', href: '/how-it-works/', match: '/how-it-works' },
  { label: 'Get started', href: '/get-started/', match: '/get-started' },
  { label: 'Contribute', href: '/contribute/', match: '/contribute' },
];

export const REPO_URL = 'https://github.com/southleft/ds-contracts-poc';
export const PLAYGROUND_URL = 'https://ds-contracts-playground.pages.dev';

/** The brand glyph — the repo logo's three diamonds, outer chevrons in
 *  currentColor so it follows the theme; the accent diamond stays brand blue. */
export const GLYPH = `<svg class="glyph" viewBox="0 0 437.1666 264.4827" aria-hidden="true" focusable="false"><path d="M212.9201,240.6041l-102.7592-102.6577c-3.1659-3.1628-3.1666-8.2939-.0014-11.4574L212.8578,23.842c3.1626-3.1611,8.2887-3.1608,11.451.0007l102.6993,102.6716c3.1635,3.1626,3.1638,8.2911.0006,11.4541l-102.6384,102.6331c-3.1616,3.1615-8.2871,3.1627-11.4502.0027Z" fill="#5aa1f2"/><path d="M282.2417,234.7913l97.5292-97.6266c2.7326-2.7353,2.7331-7.1671.001-9.9031l-97.3973-97.5358c-2.7227-2.7266-2.7329-7.1399-.0228-9.879l17.5796-17.7681c2.7318-2.7611,7.1883-2.7731,9.935-.0269l125.2475,125.226c2.7365,2.736,2.7369,7.1723.001,9.9089l-125.1874,125.2174c-2.7326,2.7332-7.1622,2.7377-9.9003.0099l-17.7737-17.7067c-2.7442-2.7338-2.7495-7.1756-.0118-9.9159Z" fill="currentColor"/><path d="M57.4354,137.1591l97.5065,97.6701c2.7355,2.7401,2.7301,7.1796-.0122,9.9129l-17.7541,17.6964c-2.7377,2.7288-7.1681,2.7251-9.9012-.0083L2.052,137.1944c-2.7364-2.7367-2.7359-7.1735.001-9.9096L127.2578,2.1195c2.7309-2.73,7.1558-2.736,9.894-.0134l17.7701,17.6684c2.7491,2.7334,2.7562,7.1796.0158,9.9217L57.438,127.2557c-2.7333,2.7349-2.7344,7.167-.0026,9.9034Z" fill="currentColor"/></svg>`;

const FAVICON =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20437.1666%20264.4827'%3E%3Cpath%20d='M212.9201,240.6041l-102.7592-102.6577c-3.1659-3.1628-3.1666-8.2939-.0014-11.4574L212.8578,23.842c3.1626-3.1611,8.2887-3.1608,11.451.0007l102.6993,102.6716c3.1635,3.1626,3.1638,8.2911.0006,11.4541l-102.6384,102.6331c-3.1616,3.1615-8.2871,3.1627-11.4502.0027Z'%20fill='%235aa1f2'/%3E%3Cpath%20d='M282.2417,234.7913l97.5292-97.6266c2.7326-2.7353,2.7331-7.1671.001-9.9031l-97.3973-97.5358c-2.7227-2.7266-2.7329-7.1399-.0228-9.879l17.5796-17.7681c2.7318-2.7611,7.1883-2.7731,9.935-.0269l125.2475,125.226c2.7365,2.736,2.7369,7.1723.001,9.9089l-125.1874,125.2174c-2.7326,2.7332-7.1622,2.7377-9.9003.0099l-17.7737-17.7067c-2.7442-2.7338-2.7495-7.1756-.0118-9.9159Z'%20fill='%23888'/%3E%3Cpath%20d='M57.4354,137.1591l97.5065,97.6701c2.7355,2.7401,2.7301,7.1796-.0122,9.9129l-17.7541,17.6964c-2.7377,2.7288-7.1681,2.7251-9.9012-.0083L2.052,137.1944c-2.7364-2.7367-2.7359-7.1735.001-9.9096L127.2578,2.1195c2.7309-2.73,7.1558-2.736,9.894-.0134l17.7701,17.6684c2.7491,2.7334,2.7562,7.1796.0158,9.9217L57.438,127.2557c-2.7333,2.7349-2.7344,7.167-.0026,9.9034Z'%20fill='%23888'/%3E%3C/svg%3E";

/** Short git SHA + date — stamped in the footer so every deploy is a receipt. */
export function buildStamp(): { sha: string; date: string } {
  let sha = 'unversioned';
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    /* building outside git is fine */
  }
  return { sha, date: new Date().toISOString().slice(0, 10) };
}

const STAMP = buildStamp();

/** Pre-paint theme resolution — the only JS besides the toggle itself. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('dsc-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}})()`;

const TOGGLE_SCRIPT = `(function(){var b=document.querySelector('.theme-toggle');if(!b)return;b.addEventListener('click',function(){var r=document.documentElement;var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var cur=r.dataset.theme||(m?'dark':'light');var next=cur==='dark'?'light':'dark';r.dataset.theme=next;try{localStorage.setItem('dsc-theme',next)}catch(e){}})})()`;

export interface PageOpts {
  /** Route, e.g. "/spec/props/". Used for nav highlighting + relative depth. */
  path: string;
  title: string;
  description: string;
  /** Extra class on <main>. */
  mainClass?: string;
  /** Optional sidebar HTML (spec pages). */
  sidebar?: string;
  /** Show the schema build stamp line in the footer (spec pages). */
  schemaStamp?: boolean;
}

export function layout(opts: PageOpts, body: string): string {
  const nav = NAV.map((n) => {
    const active = opts.path === n.match || opts.path.startsWith(n.match + '/') ? ' is-active' : '';
    return `<a class="topnav__link${active}" href="${n.href}">${n.label}</a>`;
  }).join('');

  const sidebar = opts.sidebar
    ? `<aside class="layout__sidebar"><nav aria-label="Section navigation">${opts.sidebar}</nav></aside>`
    : '';

  const schemaLine = opts.schemaStamp
    ? `<p class="footer__stamp">Reference pages generated from <code>scripts/contract-schema.ts</code> at commit <code>${STAMP.sha}</code> — the build fails if a schema branch lacks a page.</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(opts.description)}">
<meta name="color-scheme" content="light dark">
<title>${esc(opts.title)}</title>
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="/styles.css">
<script>${THEME_SCRIPT}</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="topbar">
  <div class="topbar__inner">
    <a class="topbar__brand" href="/">${GLYPH}<span class="topbar__name">Design System Contracts</span></a>
    <nav class="topnav" aria-label="Site">${nav}</nav>
    <div class="topbar__end">
      <a class="topbar__repo" href="${REPO_URL}" aria-label="GitHub repository">GitHub</a>
      <button class="theme-toggle" type="button" aria-label="Toggle color theme"><span class="theme-toggle__dot" aria-hidden="true"></span></button>
    </div>
  </div>
</header>
<div class="layout${opts.sidebar ? ' layout--sidebar' : ''}">
  ${sidebar}
  <main id="main" class="${opts.mainClass ?? ''}">${body}</main>
</div>
<footer class="footer">
  <div class="footer__inner">
    <div class="footer__cols">
      <div>
        <p class="footer__label">Project</p>
        <a href="${REPO_URL}">Repository</a>
        <a href="${PLAYGROUND_URL}">Playground</a>
        <a href="${REPO_URL}/blob/main/MILESTONES.md">Milestones</a>
        <a href="${REPO_URL}/blob/main/CHANGELOG.md">Changelog</a>
      </div>
      <div>
        <p class="footer__label">Specification</p>
        <a href="/spec/">Reference</a>
        <a href="/how-it-works/">How it works</a>
        <a href="/contribute/">Contribute</a>
        <a href="/spec/versioning/">Versioning</a>
      </div>
      <div>
        <p class="footer__label">License</p>
        <p class="footer__note">MIT — the schema, the engine, and every instrument that verifies them, under one permissive license. No gated tier.</p>
      </div>
    </div>
    ${schemaLine}
    <p class="footer__stamp">Built ${STAMP.date} at <code>${STAMP.sha}</code>. No analytics, no external requests, no cookies.</p>
  </div>
</footer>
<script>${TOGGLE_SCRIPT}</script>
</body>
</html>
`;
}

/** A light/dark asset pair rendered as two imgs; CSS shows the right one
 *  (a <picture media=…> cannot follow the manual theme toggle). */
export function themedImage(lightSrc: string, darkSrc: string, alt: string, attrs = ''): string {
  return `<img class="only-light" src="${lightSrc}" alt="${esc(alt)}" ${attrs}><img class="only-dark" src="${darkSrc}" alt="${esc(alt)}" ${attrs}>`;
}
