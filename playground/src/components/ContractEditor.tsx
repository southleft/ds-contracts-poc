import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { HIGHLIGHT_LIMIT, loadPrism, prismNow, type PrismApi } from '../engine/prism-lazy';

/**
 * The contract textarea with syntax colors AND refusal-line highlighting —
 * still one textarea, one pre.
 *
 * Technique: the classic textarea-highlight overlay, now painted. A
 * read-only, aria-hidden <pre> backdrop sits UNDER the textarea with
 * byte-identical font metrics (family, size, line-height, padding). Once
 * the lazy Prism chunk lands, the backdrop becomes the VISIBLE text layer:
 * each line is Prism-highlighted JSON (colors only — the token rules never
 * touch font-weight, so glyph metrics cannot drift), and the textarea's own
 * glyphs go transparent while its caret and selection stay. Until Prism
 * loads — or when the text is huge (≥200 KB) — the old contract holds: the
 * textarea shows its text and the backdrop renders transparent lines only
 * to carry refusal backgrounds.
 *
 * Tokenization is PER LINE (JSON is line-friendly: no token legally spans
 * a newline) so the backdrop keeps its per-line divs — refusal lines need
 * their own element for the danger background, layered under the colored
 * text. wrap="off" on the textarea plus white-space: pre on the backdrop
 * keeps both layers unwrapped — long lines scroll horizontally in lockstep
 * (scrollTop/scrollLeft synced on every scroll event and after render), so
 * a line is a line on both layers by construction.
 */

export interface ContractEditorHandle {
  /** Scroll the editor so `line` (0-based) sits in the upper third, and put the caret there. */
  scrollToLine(line: number): void;
}

interface ContractEditorProps {
  text: string;
  onChange(next: string): void;
  /** 0-based line numbers to highlight. Empty set → no refusal backgrounds. */
  highlights: ReadonlySet<number>;
  placeholder?: string;
}

export const ContractEditor = forwardRef<ContractEditorHandle, ContractEditorProps>(
  function ContractEditor({ text, onChange, highlights, placeholder }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    const syncScroll = () => {
      const ta = textareaRef.current;
      const bd = backdropRef.current;
      if (!ta || !bd) return;
      bd.scrollTop = ta.scrollTop;
      bd.scrollLeft = ta.scrollLeft;
    };

    // Keep the layers aligned after every render too — the backdrop can
    // (re)appear while the textarea is already scrolled (Prism landing,
    // refusals arriving), and a fresh backdrop starts at 0.
    useEffect(syncScroll);

    useImperativeHandle(ref, () => ({
      scrollToLine(line: number) {
        const ta = textareaRef.current;
        if (!ta) return;
        const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 18.6;
        ta.scrollTop = Math.max(0, line * lineHeight - ta.clientHeight / 3);
        // Caret to the start of the named line — the highlight plus the
        // caret make "this line" unambiguous.
        const offset = text.split('\n').slice(0, line).reduce((n, l) => n + l.length + 1, 0);
        ta.setSelectionRange(offset, offset);
        ta.focus({ preventScroll: true });
        syncScroll();
      },
    }));

    const [prism, setPrism] = useState<PrismApi | null>(prismNow);
    useEffect(() => {
      if (prism) return;
      let live = true;
      void loadPrism().then((p) => {
        if (live) setPrism(p);
      });
      return () => {
        live = false;
      };
    }, [prism]);

    const lines = useMemo(() => text.split('\n'), [text]);

    /** Per-line Prism HTML, or null while colors are off (chunk not here
     *  yet, empty text, oversized text) — then the textarea stays visible. */
    const lineHtml = useMemo(() => {
      if (!prism || text.length === 0 || text.length >= HIGHLIGHT_LIMIT) return null;
      const grammar = prism.languages.json;
      if (!grammar) return null;
      try {
        return lines.map((line) =>
          line.length > 0 ? prism.highlight(line, grammar, 'json') : ' ',
        );
      } catch {
        return null;
      }
    }, [prism, text.length, lines]);

    const showBackdrop = lineHtml !== null || highlights.size > 0;

    return (
      <div className={`editor__wrap${lineHtml ? ' editor__wrap--hl' : ''}`}>
        <div className="editor__backdrop" ref={backdropRef} aria-hidden>
          {showBackdrop ? (
            <pre className={`editor__backdrop-pre${lineHtml ? ' code-hl' : ''}`}>
              {lines.map((line, i) => {
                const cls = highlights.has(i)
                  ? 'editor__line editor__line--refused'
                  : 'editor__line';
                return lineHtml ? (
                  <div key={i} className={cls} dangerouslySetInnerHTML={{ __html: lineHtml[i] }} />
                ) : (
                  <div key={i} className={cls}>
                    {line.length > 0 ? line : ' '}
                  </div>
                );
              })}
            </pre>
          ) : null}
        </div>
        <textarea
          ref={textareaRef}
          className="editor__textarea"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          wrap="off"
          spellCheck={false}
          aria-label="Contract JSON editor"
          placeholder={placeholder}
        />
      </div>
    );
  },
);
