import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';

/**
 * The contract textarea with refusal-line highlighting — dependency-free.
 *
 * Technique: the classic textarea-highlight overlay. A read-only, aria-hidden
 * <pre> backdrop sits UNDER the textarea with byte-identical font metrics
 * (family, size, line-height, padding) and fully transparent text; the
 * textarea itself has a transparent background so the backdrop's per-line
 * danger backgrounds show through. wrap="off" on the textarea plus
 * white-space: pre on the backdrop keeps both layers unwrapped — long lines
 * scroll horizontally in lockstep (scrollTop/scrollLeft synced on every
 * scroll event), so a line is a line on both layers by construction.
 *
 * The backdrop renders each line's actual text (transparent) so widths and
 * heights track the textarea exactly; only lines named by a refusal get a
 * background. No Prism, no CodeMirror — one textarea, one pre.
 */

export interface ContractEditorHandle {
  /** Scroll the editor so `line` (0-based) sits in the upper third, and put the caret there. */
  scrollToLine(line: number): void;
}

interface ContractEditorProps {
  text: string;
  onChange(next: string): void;
  /** 0-based line numbers to highlight. Empty set → the backdrop renders nothing. */
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

    const lines = useMemo(
      () => (highlights.size > 0 ? text.split('\n') : null),
      [text, highlights],
    );

    return (
      <div className="editor__wrap">
        <div className="editor__backdrop" ref={backdropRef} aria-hidden>
          {lines ? (
            <pre className="editor__backdrop-pre">
              {lines.map((line, i) => (
                <div key={i} className={highlights.has(i) ? 'editor__line editor__line--refused' : 'editor__line'}>
                  {line.length > 0 ? line : ' '}
                </div>
              ))}
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
