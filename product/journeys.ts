import { marked } from "marked";

const APP = "https://ds-contracts-playground.pages.dev";
const SITE = "https://ds-contracts-spec.pages.dev";
const REPO = "https://github.com/southleft/ds-contracts-poc/blob/main/";

/** Shared user guide; links resolve to current local app capabilities or the
 * public reference site. Only repository-authored Markdown is accepted. */
export function renderJourneyGuide(markdown: string, surface: "app" | "site") {
  const renderer = new marked.Renderer();
  renderer.link = ({ href, tokens }) => {
    let url = href;
    if (href.startsWith("../")) url = REPO + href.slice(3);
    if (surface === "app") {
      if (href.startsWith(APP + "/")) url = href.slice(APP.length);
      if (href === SITE + "/system/") url = "/system";
      if (href === "http://localhost:5181/sources") url = "/sources";
      if (href === "http://localhost:5181/start") url = "/start";
    } else if (href.startsWith(SITE + "/")) url = href.slice(SITE.length);
    return `<a href="${url.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">${renderer.parser.parseInline(tokens)}</a>`;
  };
  return marked.parse(markdown, { renderer, async: false });
}
