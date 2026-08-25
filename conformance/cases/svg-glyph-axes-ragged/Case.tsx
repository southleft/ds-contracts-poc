/** THE ANTI-LOOSENING GUARD (raggedness by DIFFERENT MARKUP). The same glyph
 *  is drawn at (plain,sm) and (marked,lg); two OTHER glyphs sit on the
 *  opposite diagonal. The value sets of that first glyph span the whole grid,
 *  so the correlation is a DISJUNCTION, not a rectangle — no contract
 *  spelling exists and the asset must still refuse by its original name. */
const D: Record<string, Record<string, string>> = {
  plain: { sm: 'M 2 6 L 5 9 L 10 2', lg: 'M 3 3 L 13 13 M 13 3 L 3 13' },
  marked: { sm: 'M 2 2 L 10 10', lg: 'M 2 6 L 5 9 L 10 2' },
};

export default function Case({
  tone = 'plain',
  size = 'sm',
}: {
  tone?: 'plain' | 'marked';
  size?: 'sm' | 'lg';
}) {
  return (
    <div className="cf-root" data-cf="svg-glyph-axes-ragged" data-tone={tone} data-size={size}>
      <span className="cf-a">
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path d={D[tone][size]} />
        </svg>
      </span>
    </div>
  );
}
