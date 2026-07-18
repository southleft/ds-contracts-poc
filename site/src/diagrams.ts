/**
 * Build-time themed SVG diagrams — the docs/assets/contract-flow-*.svg
 * pattern: every diagram is emitted twice (light + dark) at build and paired
 * on the page via themedImage(); no client JS is involved in theming.
 *
 * Four hand-drawn diagrams (prop lifecycle, session linking, receipts flow,
 * instrument relationships) plus one COMPUTED diagram: the dependency graph
 * rendered from the committed whole-kit capture (see how-replays.ts for the
 * data extraction — this module only draws what it is handed).
 */

export type Theme = 'light' | 'dark';

interface Palette {
  boxFill: string;
  boxStroke: string;
  coreFill: string;
  coreText: string;
  coreSub: string;
  text: string;
  sub: string;
  flow: string;
  back: string;
  danger: string;
  ok: string;
  hub: string;
}

const PALETTES: Record<Theme, Palette> = {
  light: {
    boxFill: '#ffffff',
    boxStroke: '#d1d5db',
    coreFill: '#171717',
    coreText: '#ffffff',
    coreSub: 'rgba(255,255,255,.75)',
    text: '#111827',
    sub: '#6b7280',
    flow: '#111827',
    back: '#6b7280',
    danger: '#dc2626',
    ok: '#198038',
    hub: '#0f62fe',
  },
  dark: {
    boxFill: '#1f2937',
    boxStroke: '#4b5563',
    coreFill: '#f3f4f6',
    coreText: '#111827',
    coreSub: 'rgba(17,24,39,.7)',
    text: '#f3f4f6',
    sub: '#9ca3af',
    flow: '#f3f4f6',
    back: '#9ca3af',
    danger: '#f87171',
    ok: '#42be65',
    hub: '#78a9ff',
  },
};

function svgOpen(theme: Theme, w: number, h: number, label: string, arrowIds: string[] = ['arrow']): string {
  const p = PALETTES[theme];
  const markers = arrowIds
    .map(
      (id) =>
        `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label.replaceAll('"', '&quot;')}" style="max-width:100%;height:auto;font-family:inherit">
  <defs>${markers}</defs>
  <style>
    .box { fill: ${p.boxFill}; stroke: ${p.boxStroke}; stroke-width: 1.5; }
    .core { fill: ${p.coreFill}; }
    .t { fill: ${p.text}; font-size: 15px; font-weight: 600; }
    .tc { fill: ${p.coreText}; font-size: 15px; font-weight: 600; }
    .s { fill: ${p.sub}; font-size: 12px; }
    .sc { fill: ${p.coreSub}; font-size: 12px; }
    .flow { stroke: ${p.flow}; stroke-width: 1.8; fill: none; }
    .back { stroke: ${p.back}; stroke-width: 1.6; fill: none; stroke-dasharray: 6 4; }
    .lbl { fill: ${p.text}; font-size: 12.5px; font-weight: 600; }
    .lbl2 { fill: ${p.sub}; font-size: 11.5px; }
    .bad { stroke: ${p.danger}; }
    .badt { fill: ${p.danger}; }
    .okt { fill: ${p.ok}; }
    .mono { font-family: ui-monospace, Menlo, monospace; }
  </style>`;
}

const CLOSE = '\n</svg>\n';

/** A titled box with up to three sub-lines, centered text. */
function box(x: number, y: number, w: number, h: number, title: string, subs: string[], core = false): string {
  const cx = x + w / 2;
  const tCls = core ? 'tc' : 't';
  const sCls = core ? 'sc' : 's';
  const lines = subs
    .map((s, i) => `<text class="${sCls}" x="${cx}" y="${y + 48 + i * 18}" text-anchor="middle">${s}</text>`)
    .join('\n  ');
  return `<rect class="${core ? 'core' : 'box'}" x="${x}" y="${y}" width="${w}" height="${h}"/>
  <text class="${tCls}" x="${cx}" y="${y + 26}" text-anchor="middle">${title}</text>
  ${lines}`;
}

// ---------------------------------------------------------------------------
// 1 · Prop lifecycle — how a property is added
// ---------------------------------------------------------------------------

export function propLifecycleSvg(theme: Theme): string {
  const parts: string[] = [
    svgOpen(
      theme,
      960,
      470,
      'Lifecycle of an added property: a hand edit on one surface is flagged by the differ as code AHEAD with a complete proposed contract patch; a human promotes the patch into the contract, bumping its version; both surfaces regenerate from the contract; the differ verifies — a surface that skipped regeneration is named figma BEHIND until it catches up.',
    ),
  ];
  // Row 1: hand edit → differ → promotion
  parts.push(box(20, 40, 280, 110, '1 · The hand edit', ['an engineer adds', 'loading?: boolean', 'to the generated Button.tsx']));
  parts.push(box(340, 40, 280, 110, '2 · The differ flags it', ['[code AHEAD] Button.loading', 'with a complete proposed', 'contract patch — bindings included']));
  parts.push(box(660, 40, 280, 110, '3 · Promotion (human)', ['patch reviewed, applied to', 'button.contract.json', 'version 1.0.0 → 1.1.0']));
  parts.push(`<line class="flow" x1="300" y1="95" x2="335" y2="95" marker-end="url(#arrow)"/>`);
  parts.push(`<line class="flow" x1="620" y1="95" x2="655" y2="95" marker-end="url(#arrow)"/>`);
  // Down from promotion to the contract core
  parts.push(`<line class="flow" x1="800" y1="150" x2="800" y2="185" marker-end="url(#arrow)"/>`);
  parts.push(box(660, 190, 280, 90, 'THE CONTRACT', ['button.contract.json v1.1.0', 'the only arbiter'], true));
  // Regenerate both surfaces
  parts.push(box(340, 190, 280, 90, '4 · Regenerate', ['npm run build — every emitter', 're-renders from the contract']));
  parts.push(`<line class="flow" x1="655" y1="235" x2="625" y2="235" marker-end="url(#arrow)"/>`);
  parts.push(box(20, 170, 280, 60, 'Code surface', ['typed prop + spinner + CSS']));
  parts.push(box(20, 250, 280, 60, 'Design surface', ['Loading BOOLEAN property']));
  parts.push(`<line class="flow" x1="335" y1="210" x2="305" y2="200" marker-end="url(#arrow)"/>`);
  parts.push(`<line class="flow" x1="335" y1="260" x2="305" y2="272" marker-end="url(#arrow)"/>`);
  // Differ verification row
  parts.push(box(340, 320, 280, 80, '5 · The differ verifies', ['npm run parity → clean', 'only when BOTH surfaces carry v1.1.0']));
  parts.push(`<line class="back" x1="480" y1="285" x2="480" y2="315" marker-end="url(#arrow)"/>`);
  parts.push(
    `<path class="back bad" d="M 160 315 C 160 372, 230 372, 335 372" marker-end="url(#arrow)"/>`,
    `<text class="lbl badt" x="20" y="404" text-anchor="start">a surface that skipped regeneration is named:</text>`,
    `<text class="lbl badt" x="20" y="420" text-anchor="start">[figma BEHIND] Button.Loading</text>`,
  );
  parts.push(`<text class="lbl2" x="480" y="452" text-anchor="middle">a change on either surface takes the same path — proposal → human promotion → regeneration; one arbiter, and a differ that names whichever surface lags</text>`);
  return parts.join('\n  ') + CLOSE;
}

// ---------------------------------------------------------------------------
// 2 · Session linking — how nested components resolve
// ---------------------------------------------------------------------------

export function sessionLinkingSvg(theme: Theme): string {
  const parts: string[] = [
    svgOpen(
      theme,
      960,
      520,
      'Session-linking sequence for nested components: each imported set registers its contract in the session by component key and by name. When a later import draws an instance of another set, the engine resolves the child through the session key first, then by name, then against already-registered contracts; a child that resolves nowhere becomes a stub contract carrying only the observed geometry, named as such. Importing the missing child later and re-importing the parent upgrades the stub to a real link.',
    ),
  ];
  // Left: the drawn chain
  parts.push(`<text class="lbl" x="30" y="40">The drawn chain (CBDS kit)</text>`);
  parts.push(box(30, 55, 200, 56, 'Dialog', ['draws 4 action buttons + icons']));
  parts.push(box(60, 145, 200, 56, 'Button-Brand Primary', ['draws 2 icon slots']));
  parts.push(box(90, 235, 200, 56, 'Icon', ['leaf glyph set']));
  parts.push(`<line class="flow" x1="120" y1="111" x2="150" y2="140" marker-end="url(#arrow)"/>`);
  parts.push(`<line class="flow" x1="150" y1="201" x2="180" y2="230" marker-end="url(#arrow)"/>`);
  parts.push(`<text class="lbl2" x="30" y="330">instances point at other sets —</text>`);
  parts.push(`<text class="lbl2" x="30" y="346">contracts stay per-component; the</text>`);
  parts.push(`<text class="lbl2" x="30" y="362">parent embeds children BY REFERENCE</text>`);

  // Center: the session registry
  parts.push(box(370, 55, 250, 120, 'SESSION REGISTRY', ['every imported contract, keyed by', 'component key + drawn name', '(newest wins on re-import)'], true));
  // Right: resolution ladder
  parts.push(box(680, 40, 260, 190, 'Child resolution, in order', []));
  parts.push(`<text class="s" x="700" y="80">1 · session, by component key → <tspan class="okt" font-weight="600">link</tspan></text>`);
  parts.push(`<text class="s" x="700" y="106">2 · session / repo, by name → <tspan class="okt" font-weight="600">link</tspan></text>`);
  parts.push(`<text class="s" x="700" y="132">3 · unresolved → <tspan font-weight="600">stub</tspan> contract with the</text>`);
  parts.push(`<text class="s" x="712" y="152">OBSERVED geometry + applied props,</text>`);
  parts.push(`<text class="s" x="712" y="172">named a stub in its own description</text>`);
  parts.push(`<text class="s" x="700" y="204">a contradicting key never links —</text>`);
  parts.push(`<text class="s" x="712" y="220">absence is never evidence</text>`);
  parts.push(`<line class="flow" x1="625" y1="115" x2="675" y2="115" marker-end="url(#arrow)"/>`);
  parts.push(`<text class="lbl" x="650" y="103" text-anchor="middle">resolve</text>`);
  parts.push(`<line class="flow" x1="295" y1="83" x2="365" y2="95" marker-end="url(#arrow)"/>`);
  parts.push(`<text class="lbl" x="330" y="76" text-anchor="middle">import</text>`);

  // Bottom: the upgrade path
  parts.push(box(370, 290, 250, 90, 'STUB in the parent', ['ds.button-brand-primary v0.1.0', '“Import the child set to', 'replace this stub.”']));
  parts.push(box(680, 290, 260, 90, 'LINK after re-import', ['the child set arrives in session;', 're-importing the parent resolves', 'the same ref to the real contract']));
  parts.push(`<line class="back" x1="625" y1="335" x2="675" y2="335" marker-end="url(#arrow)"/>`);
  parts.push(`<text class="lbl" x="650" y="323" text-anchor="middle">upgrade</text>`);
  parts.push(`<line class="back" x1="495" y1="180" x2="495" y2="285" marker-end="url(#arrow)"/>`);
  parts.push(`<text class="lbl2" x="505" y="240">child not in session yet</text>`);
  parts.push(`<text class="lbl2" x="480" y="440" text-anchor="middle">nothing is silently rewritten: the stub is named in its own description, and the upgrade is a re-import through the same door</text>`);
  parts.push(`<text class="lbl2" x="480" y="460" text-anchor="middle">replayed below from the committed Dialog / Button-Brand Primary / Icon captures — the numbers are the engine’s, not this page’s</text>`);
  return parts.join('\n  ') + CLOSE;
}

// ---------------------------------------------------------------------------
// 3 · Receipts flow — determinism page
// ---------------------------------------------------------------------------

export function receiptsFlowSvg(theme: Theme): string {
  const parts: string[] = [
    svgOpen(
      theme,
      960,
      430,
      'Receipts flow: the contract feeds four emitters behind one interface; emitted surfaces are pinned by a golden manifest of SHA-256 hashes, illegal contracts are refused by name before anything emits, every token reference must resolve through the integrity gate, and imports name every loss as a degradation code. Each gate writes a committed receipt.',
    ),
  ];
  parts.push(box(30, 150, 200, 110, 'THE CONTRACT', ['*.contract.json', '+ DTCG tokens'], true));
  parts.push(box(310, 150, 240, 110, 'Four emitters', ['react · html · react-inline · figma', 'one interface, pure functions']));
  parts.push(box(640, 150, 280, 110, 'Emitted surfaces', ['byte-identical on every run', 'from the same contract']));
  parts.push(`<line class="flow" x1="230" y1="205" x2="305" y2="205" marker-end="url(#arrow)"/>`);
  parts.push(`<line class="flow" x1="550" y1="205" x2="635" y2="205" marker-end="url(#arrow)"/>`);
  // Gates above
  parts.push(box(310, 30, 240, 80, 'Refusal, by name', ['validateContract — an illegal', 'contract never emits']));
  parts.push(`<line class="back" x1="430" y1="110" x2="430" y2="145" marker-end="url(#arrow)"/>`);
  parts.push(box(30, 30, 200, 80, 'Integrity gate', ['every token ref must resolve', 'or the build fails, named']));
  parts.push(`<line class="back" x1="130" y1="110" x2="130" y2="145" marker-end="url(#arrow)"/>`);
  // Gates below
  parts.push(box(640, 300, 280, 90, 'Golden manifest', ['evals/golden.json — SHA-256 over', 'every generated file; a changed', 'byte fails the eval by name']));
  parts.push(`<line class="back" x1="780" y1="295" x2="780" y2="265" marker-end="url(#arrow)"/>`);
  parts.push(box(30, 300, 460, 90, 'Degradation codes (import direction)', ['every channel a capture reads but cannot carry is a named', 'receipt — counted per component set, never silently dropped']));
  parts.push(`<line class="back" x1="130" y1="295" x2="130" y2="265" marker-end="url(#arrow)"/>`);
  parts.push(`<text class="lbl2" x="480" y="420" text-anchor="middle">every gate writes a committed receipt: golden.json · eval results · the census counts · the parity report</text>`);
  return parts.join('\n  ') + CLOSE;
}

// ---------------------------------------------------------------------------
// 4 · Instrument relationships — instruments page
// ---------------------------------------------------------------------------

export function instrumentsSvg(theme: Theme): string {
  const parts: string[] = [
    svgOpen(
      theme,
      960,
      470,
      'Instrument relationships: the eval suite gates the engine itself on every change. Three standing instruments measure the same engine against material the project does not own — the whole-kit census replays an entire enterprise kit through the import pipeline, the visual-parity instrument diffs emitted previews against the design tool renders, and the enterprise gauntlet runs four external code bases through the unmodified extractor. Each publishes a committed report.',
    ),
  ];
  parts.push(box(360, 180, 240, 110, 'THE ENGINE', ['schema + emitters + differ', '+ import pipeline'], true));
  parts.push(box(360, 30, 240, 90, 'The eval suite', ['deterministic checks on every', 'change — refusals, golden', 'manifests, drift detection']));
  parts.push(`<line class="flow" x1="480" y1="120" x2="480" y2="175" marker-end="url(#arrow)"/>`);
  parts.push(`<text class="lbl" x="492" y="150">gates</text>`);
  parts.push(box(30, 180, 260, 110, 'Whole-kit census', ['an entire enterprise kit replayed', 'through the import pipeline —', 'clean rate + facts + degradations']));
  parts.push(`<line class="back" x1="295" y1="235" x2="355" y2="235" marker-end="url(#arrow)"/>`);
  parts.push(box(670, 180, 260, 110, 'Visual parity', ['emitted previews diffed against', 'the design tool’s own renders —', 'worst-first queue + baseline gate']));
  parts.push(`<line class="back" x1="665" y1="235" x2="605" y2="235" marker-end="url(#arrow)"/>`);
  parts.push(box(280, 330, 400, 90, 'Enterprise gauntlet', ['four external design systems at pinned SHAs through', 'the unmodified code extractor — every workaround named']));
  parts.push(`<line class="back" x1="480" y1="325" x2="480" y2="295" marker-end="url(#arrow)"/>`);
  parts.push(`<text class="lbl2" x="480" y="450" text-anchor="middle">every instrument publishes a committed report with real numbers — measurement against material this project does not own</text>`);
  return parts.join('\n  ') + CLOSE;
}

// ---------------------------------------------------------------------------
// 5 · Dependency graph — computed from the committed whole-kit capture
// ---------------------------------------------------------------------------

export interface GraphNode {
  name: string;
  depth: number;
  usesIcon: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  /** [from, to] pairs, both present in nodes, Icon edges excluded. */
  edges: Array<[string, string]>;
  iconRefs: number;
  compositeCount: number;
  totalSets: number;
}

/** Natural size of the rendered graph — used by the page to set explicit
 *  img dimensions (the graph scrolls at natural size instead of shrinking). */
export function dependencyGraphSize(g: GraphData): { width: number; height: number } {
  const svg = dependencyGraphSvg('light', g);
  const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!m) throw new Error('dependencyGraphSize: no viewBox');
  return { width: Number(m[1]), height: Number(m[2]) };
}

export function dependencyGraphSvg(theme: Theme, g: GraphData): string {
  const p = PALETTES[theme];
  const NODE_W = 176;
  const NODE_H = 21;
  const ROW_GAP = 7;
  const COL_GAP = 66;
  const MAX_ROWS = 24;
  const maxDepth = Math.max(...g.nodes.map((n) => n.depth));

  // Bands: depth maxDepth (deepest composites) on the LEFT → depth 0 leaves on the RIGHT.
  // Icon is drawn as a dedicated hub box, not a band row.
  interface Placed {
    x: number;
    y: number;
  }
  const placed = new Map<string, Placed>();
  const bands: string[][] = [];
  for (let d = maxDepth; d >= 0; d--) {
    bands.push(
      g.nodes
        .filter((n) => n.depth === d && n.name !== 'Icon')
        .map((n) => n.name)
        .sort((a, b) => a.localeCompare(b)),
    );
  }
  // Sub-columns per band when a band exceeds MAX_ROWS.
  let x = 20;
  let maxY = 0;
  const TOP = 78;
  const bandX: number[] = [];
  for (const band of bands) {
    bandX.push(x);
    const cols = Math.max(1, Math.ceil(band.length / MAX_ROWS));
    const rows = Math.ceil(band.length / cols);
    band.forEach((name, i) => {
      const c = Math.floor(i / rows);
      const r = i % rows;
      const nx = x + c * (NODE_W + 10);
      const ny = TOP + r * (NODE_H + ROW_GAP);
      placed.set(name, { x: nx, y: ny });
      maxY = Math.max(maxY, ny + NODE_H);
    });
    x += cols * (NODE_W + 10) - 10 + COL_GAP;
  }
  const width = x - COL_GAP + 20;
  // The Icon hub: bottom-right region.
  const hub = { x: width - NODE_W - 20, y: maxY + 46, w: NODE_W, h: 40 };
  const height = hub.y + hub.h + 56;

  const parts: string[] = [
    svgOpen(
      theme,
      width,
      height,
      `Dependency graph computed from the committed whole-kit capture: the ${g.compositeCount} component sets that draw instances of other sets, arranged by dependency depth (deepest composition on the left, leaf components on the right), with each instance edge drawn. Edges into the Icon set (${g.iconRefs} of them) are aggregated into one hub marker for legibility; the remaining ${g.totalSets - g.nodes.length} sets of the ${g.totalSets}-set kit participate in no instance edge and are elided.`,
      ['garrow'],
    ),
  ];

  // Edges first (under nodes).
  for (const [from, to] of g.edges) {
    const a = placed.get(from);
    const b = placed.get(to);
    if (!a || !b) continue;
    const x1 = a.x + NODE_W;
    const y1 = a.y + NODE_H / 2;
    const x2 = b.x;
    const y2 = b.y + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    parts.push(
      `<path d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" fill="none" stroke="${p.back}" stroke-width="1" opacity="0.38" marker-end="url(#garrow)"/>`,
    );
  }

  // Nodes.
  for (const n of g.nodes) {
    if (n.name === 'Icon') continue;
    const pos = placed.get(n.name)!;
    const dot = n.usesIcon
      ? `<circle cx="${pos.x + NODE_W - 9}" cy="${pos.y + NODE_H / 2}" r="2.6" fill="${p.hub}"/>`
      : '';
    // Keep labels clear of the hub marker; a truncation is visible, not silent.
    const maxChars = n.usesIcon ? 23 : 25;
    const label = n.name.length > maxChars ? `${n.name.slice(0, maxChars - 1)}…` : n.name;
    parts.push(
      `<rect class="box" x="${pos.x}" y="${pos.y}" width="${NODE_W}" height="${NODE_H}"/>
  <text x="${pos.x + 7}" y="${pos.y + 15}" fill="${p.text}" font-size="10.5px" class="mono">${label.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</text>${dot}`,
    );
  }

  // The Icon hub.
  parts.push(
    `<rect class="core" x="${hub.x}" y="${hub.y}" width="${hub.w}" height="${hub.h}"/>
  <text class="tc" x="${hub.x + hub.w / 2}" y="${hub.y + 17}" text-anchor="middle" font-size="13px">Icon</text>
  <text class="sc" x="${hub.x + hub.w / 2}" y="${hub.y + 32}" text-anchor="middle" font-size="10.5px">the kit’s one true hub</text>`,
  );

  // Legend.
  const legendY = hub.y + 14;
  parts.push(
    `<circle cx="26" cy="${legendY}" r="2.6" fill="${p.hub}"/>
  <text class="lbl2" x="36" y="${legendY + 4}">= instantiates Icon (${g.iconRefs} of ${g.compositeCount} composites do — those edges are aggregated here, not drawn)</text>
  <text class="lbl2" x="20" y="${legendY + 24}">elided: ${(g.totalSets - g.nodes.length).toLocaleString('en-US')} of ${g.totalSets.toLocaleString('en-US')} sets participate in no instance edge (icon glyphs and standalone components)</text>
  <text class="lbl2" x="20" y="${legendY + 44}">computed at site-build time from the committed capture — nodes, edges, and counts are read from the file, not drawn by hand</text>`,
  );
  // Column captions.
  parts.push(`<text class="lbl" x="${bandX[0]}" y="40">deepest composition</text>`);
  parts.push(`<text class="lbl" x="${bandX[bandX.length - 1]}" y="40">leaf components</text>`);
  parts.push(`<text class="lbl2" x="${bandX[0]}" y="58">build order runs right → left: leaves first, composites after their children</text>`);

  return parts.join('\n  ') + CLOSE;
}
