/** THE ANTI-OVERDRAW GUARD (raggedness by ABSENCE). One glyph is drawn at
 *  (plain,sm) and (marked,lg) and the library draws NOTHING at (plain,lg) and
 *  (marked,sm); two further glyphs on `other` keep the single-axis search from
 *  succeeding. The per-axis value sets of the shared glyph form a rectangle
 *  that COVERS two cells the library leaves empty — carrying it would mint ink
 *  that does not exist, so the asset must refuse. */
const D: Record<string, Record<string, string | null>> = {
  plain: { sm: 'M 2 6 L 5 9 L 10 2', lg: null },
  marked: { sm: null, lg: 'M 2 6 L 5 9 L 10 2' },
  other: { sm: 'M 2 2 L 10 10', lg: 'M 3 3 L 13 13 M 13 3 L 3 13' },
};

export default function Case({
  tone = 'plain',
  size = 'sm',
}: {
  tone?: 'plain' | 'marked' | 'other';
  size?: 'sm' | 'lg';
}) {
  const d = D[tone][size];
  return (
    <div className="cf-root" data-cf="svg-glyph-absent-cells" data-tone={tone} data-size={size}>
      <span className="cf-a">
        {d === null ? null : (
          <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path d={d} />
          </svg>
        )}
      </span>
    </div>
  );
}
