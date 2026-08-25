/** Glyph path data that varies over TWO enum axes at once (fluent.checkbox:
 *  the indicator draws a check or a dash by `checked`, at a DIFFERENT authored
 *  path by `size`). Every conjunction is drawn — the correlation is a
 *  RECTANGLE, so it has a contract spelling (visibleWhen + stylesWhen). */
const D: Record<string, Record<string, string>> = {
  plain: { sm: 'M 2 6 L 5 9 L 10 2', lg: 'M 3 8 L 7 12 L 13 3' },
  marked: { sm: 'M 2 2 L 10 10 M 10 2 L 2 10', lg: 'M 3 3 L 13 13 M 13 3 L 3 13' },
};

export default function Case({
  tone = 'plain',
  size = 'sm',
}: {
  tone?: 'plain' | 'marked';
  size?: 'sm' | 'lg';
}) {
  return (
    <div className="cf-root" data-cf="svg-glyph-two-axis" data-tone={tone} data-size={size}>
      <span className="cf-a">
        <svg viewBox={size === 'sm' ? '0 0 12 12' : '0 0 16 16'} xmlns="http://www.w3.org/2000/svg">
          <path d={D[tone][size]} />
        </svg>
      </span>
    </div>
  );
}
