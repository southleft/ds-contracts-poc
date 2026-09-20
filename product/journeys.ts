import { marked } from "marked";
import { resolveDocumentLink } from "./document-links.js";

const APP = "https://ds-contracts-playground.pages.dev";
const SITE = "https://ds-contracts-spec.pages.dev";

/** Shared user guide; links resolve to current local app capabilities or the
 * public reference site. Only repository-authored Markdown is accepted. */
export function renderJourneyGuide(markdown: string, surface: "app" | "site") {
  const renderer = new marked.Renderer();
  renderer.link = ({ href, tokens }) => {
    let url = resolveDocumentLink(href, surface);
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
