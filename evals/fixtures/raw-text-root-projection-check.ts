/**
 * raw-text-root-projection eval body — live-gauntlet class ④
 * (linked-child-html-escaped-as-text): CBDS Text Area rendered the literal
 * string '<div class="input-label">' as VISIBLE TEXT inside the field. The
 * corrected diagnosis: the linked child's markup was never escaped by the
 * emitter — the parent's inferred root element is <textarea>, a RAW-TEXT
 * element, so the BROWSER parses every child tag as text. Void roots
 * (<input>) hoist children out of the box (the input-family 48–66% rows) and
 * <select> drops structural children (Dropdown rendered only the caret).
 *
 * Pins (emit-html root content-model honesty):
 *   · textarea/select-with-structure roots with drawn anatomy project the
 *     BOX as a neutral <div> (same classes), with a NAMED comment
 *   · VOID roots (<input>) with drawn anatomy REFUSE via the shared
 *     void-element mount guard (commit 8c28dfe8) before any projection —
 *     the React surface would render NOTHING, so the html surface must not
 *     silently "fix" it; the guard's prescribed re-rooting emits cleanly
 *   · the linked child's markup renders as REAL STRUCTURE (never escaped,
 *     never literal text in a raw-text context)
 *   · leaf TEXT still escapes — a text default carrying markup renders as
 *     &lt;…&gt;, the XSS pin (fix must not open contract-text injection)
 *   · a part-less textarea/input root keeps its native element — the
 *     projection triggers only when the content model would eat the anatomy
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import { ContractSchema } from '../../scripts/contract-schema.js';
import { emitHtml } from '../../core/emit-html.js';

const fail = (msg: string): never => {
  console.error(`✘ raw-text-root-projection: ${msg}`);
  process.exit(1);
};

const child = ContractSchema.parse({
  id: 'ds.eval-input-label',
  name: 'EvalInputLabel',
  version: '0.1.0',
  status: 'draft',
  description: 'label child',
  semantics: { element: 'div' },
  props: [
    {
      name: 'label',
      type: 'text',
      default: '<script>alert("xss")</script>',
      bindings: { figma: { kind: 'TEXT', property: 'Label' }, code: { prop: 'children' } },
    },
  ],
  states: [],
  events: [],
  anatomy: {
    root: {
      parts: { label: { content: { prop: 'children' } } },
    },
  },
  anchors: {
    figma: { fileKey: null, componentSetKey: null },
    code: { importPath: 'src/components/EvalInputLabel', export: 'EvalInputLabel' },
  },
});

const parentFor = (element: string, withParts: boolean) =>
  ContractSchema.parse({
    id: 'ds.eval-field',
    name: 'EvalField',
    version: '0.1.0',
    status: 'draft',
    description: 'field parent',
    semantics: { element },
    props: [],
    states: [],
    events: [],
    anatomy: {
      root: withParts
        ? {
            parts: {
              inputLabel: { component: { id: 'ds.eval-input-label' } },
              box: { parts: { hint: { text: 'hint text' } } },
            },
          }
        : {},
    },
    anchors: {
      figma: { fileKey: null, componentSetKey: null },
      code: { importPath: 'src/components/EvalField', export: 'EvalField' },
    },
  });

const ctx = { tokens: {} as never, icons: new Map<string, string>(), contracts: new Map([[child.id, child]]) };

// 1) textarea root WITH drawn anatomy → projected box, real child structure,
//    escaped leaf text.
{
  const out = emitHtml(parentFor('textarea', true), ctx as never);
  if (out.html.includes('<textarea')) {
    fail('textarea root with drawn anatomy still renders <textarea> — the browser would show child markup as literal text');
  }
  if (!out.html.includes('cannot host the drawn anatomy')) {
    fail('the content-model projection is not NAMED in an emitted comment');
  }
  if (!out.html.includes('<div class="eval-input-label">')) {
    fail('linked-child markup is not rendered as real structure');
  }
  if (out.html.includes('&lt;div')) {
    fail('linked-child markup was HTML-escaped — structure became text');
  }
  if (!out.html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')) {
    fail('leaf text with markup is NOT escaped — the projection opened contract-text injection');
  }
  if (out.html.includes('<script>alert')) {
    fail('raw <script> from a contract text default reached the page — XSS');
  }
}

// 2) input (void) root with anatomy — SUPERSEDED by the emit-side
//    void-element mount guard (#48 class, commit 8c28dfe8): validateContract
//    now refuses this contract shape BY NAME on every surface BEFORE the
//    html projection can fire, because the React surface would mount the
//    same anatomy inside <input> and render NOTHING at runtime. A silent
//    <div> projection on the html surface alone would hide exactly the
//    defect the guard exists to refuse. Pin BOTH halves of the void story:
//    (a) the old void-root shape refuses loudly with the guard's message;
//    (b) the guard's own prescribed fix (container root, <input> mounted as
//        a child part) emits cleanly, keeps the native <input>, and needs
//        no projection. The raw-text (textarea) and select projections in
//        cases 1/3 are untouched — those elements are not void, so the
//        guard does not fire and the projection remains their honesty story.
{
  let refusal = '';
  try {
    emitHtml(parentFor('input', true), ctx as never);
  } catch (e) {
    refusal = e instanceof Error ? e.message : String(e);
  }
  if (!refusal.includes('cannot mount inside void element <input>')) {
    fail('void input root with drawn anatomy was NOT refused by the void-element mount guard — a silent html-only projection would hide a React surface that renders NOTHING');
  }
  if (!refusal.includes('Re-root the part')) {
    fail('the void-root refusal does not carry its own fix message');
  }
  const rerooted = ContractSchema.parse({
    id: 'ds.eval-field',
    name: 'EvalField',
    version: '0.1.0',
    status: 'draft',
    description: 'field parent re-rooted per the void-guard fix message',
    semantics: { element: 'div' },
    props: [],
    states: [],
    events: [],
    anatomy: {
      root: {
        parts: {
          inputLabel: { component: { id: 'ds.eval-input-label' } },
          control: { element: 'input' },
        },
      },
    },
    anchors: {
      figma: { fileKey: null, componentSetKey: null },
      code: { importPath: 'src/components/EvalField', export: 'EvalField' },
    },
  });
  const out = emitHtml(rerooted, ctx as never);
  if (!out.html.includes('<input')) fail('re-rooted contract (container root, input as child part) lost its native <input> control');
  if (out.html.includes('cannot host the drawn anatomy')) fail('re-rooted container root carries a projection comment it does not need');
  if (!out.html.includes('<div class="eval-input-label">')) fail('re-rooted contract: linked-child markup is not rendered as real structure');
}

// 3) select root with structural anatomy → projected.
{
  const out = emitHtml(parentFor('select', true), ctx as never);
  if (out.html.includes('<select')) fail('select root with structural anatomy still renders <select> — the parser drops non-option children');
}

// 4) part-less textarea root keeps its native element — no over-projection.
{
  const out = emitHtml(parentFor('textarea', false), ctx as never);
  if (!out.html.includes('<textarea')) fail('part-less textarea root lost its native element — projection over-fired');
  if (out.html.includes('cannot host the drawn anatomy')) fail('part-less textarea root carries a projection comment it does not need');
}

console.log('raw-text-root-projection ok: textarea/select boxes project to <div> with a named comment; void roots refuse via the mount guard and re-root cleanly per its fix message; child markup stays structure; leaf text stays escaped (XSS pin holds); part-less native roots untouched');
