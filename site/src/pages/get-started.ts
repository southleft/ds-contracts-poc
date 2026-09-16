import { readFileSync } from "node:fs";
import { layout } from "../html.js";
import { renderJourneyGuide } from "../../../product/journeys.js";

export function getStartedPage() {
  const body = renderJourneyGuide(
    readFileSync("docs/USER-JOURNEYS.md", "utf8"),
    "site",
  );
  return {
    route: "/get-started/",
    html: layout(
      {
        path: "/get-started/",
        title: "Start with your library — Design System Contracts",
        description:
          "Installation, designer-first, code-first and existing-library workflows, with current availability and the next delivery milestone.",
        mainClass: "product-overview",
      },
      `<article>${body}</article>`,
    ),
  };
}
