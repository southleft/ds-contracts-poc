import { marked } from "marked";

/** Only repository-authored Markdown is accepted here, never imported user content. */
export function renderProductOverview(
  markdown: string,
  diagramUrl: string,
): string {
  const renderer = new marked.Renderer();
  renderer.image = ({ text, href }) => {
    if (href !== "assets/product-loop.svg")
      throw new Error(`Unknown product diagram: ${href}`);
    const esc = (s: string) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;");
    return `<img class="product-overview__diagram" src="${esc(diagramUrl)}" alt="${esc(text)}" />`;
  };
  renderer.link = ({ href, tokens }) => {
    const url = href.startsWith("../")
      ? `https://github.com/southleft/ds-contracts-poc/blob/main/${href.slice(3)}`
      : href;
    return `<a href="${url.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">${renderer.parser.parseInline(tokens)}</a>`;
  };
  return marked.parse(markdown, { renderer, async: false });
}
