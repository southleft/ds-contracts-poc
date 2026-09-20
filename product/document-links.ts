const REPO = "https://github.com/southleft/ds-contracts-poc/blob/main/";

/** Markdown lives in docs/, while its two rendered pages have application routes.
 * Keep their anchors local and send other repository references to their files. */
export function resolveDocumentLink(
  href: string,
  surface: "app" | "site",
): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) return href;
  const resolved = new URL(href, REPO + "docs/");
  if (!resolved.pathname.endsWith(".md") && !href.startsWith("../"))
    return href;
  const file = resolved.pathname.slice(new URL(REPO).pathname.length);
  const routes =
    surface === "app"
      ? { "docs/CURRENT.md": "/system", "docs/USER-JOURNEYS.md": "/start" }
      : {
          "docs/CURRENT.md": "/system/",
          "docs/USER-JOURNEYS.md": "/get-started/",
        };
  const route = routes[file as keyof typeof routes];
  return route ? route + resolved.search + resolved.hash : resolved.href;
}
