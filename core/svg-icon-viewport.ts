/** A declared icon size sets the root viewport, preserving authored viewBox
 * geometry and stroke widths. Never rewrite dimensions on a child element. */
export function svgIconViewport(markup: string, size: number): string {
  return markup.replace(/^<svg\b[^>]*>/, (tag) => {
    for (const dimension of ["width", "height"]) {
      const attribute = new RegExp(
        `\\s${dimension}\\s*=\\s*(?:"[^"]*"|'[^']*')`,
      );
      tag = attribute.test(tag)
        ? tag.replace(attribute, ` ${dimension}="${size}"`)
        : tag.replace(/^<svg\b/, `<svg ${dimension}="${size}"`);
    }
    return tag;
  });
}
