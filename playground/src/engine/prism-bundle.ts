/**
 * The one lazy Prism chunk: core (markup, css, clike, javascript ship
 * inside it) plus the grammars the output panes speak. Evaluation order
 * matters — each component file attaches to the global namespace the core
 * registers — and static import order guarantees core runs first.
 *
 * Never import this module statically; go through engine/prism-lazy.ts,
 * which sets Prism.manual before the core evaluates (so the auto-
 * highlighter never scans the document) and hands out the loaded API.
 */
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

export default Prism;
