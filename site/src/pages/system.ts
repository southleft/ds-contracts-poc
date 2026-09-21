import { readFileSync } from "node:fs";
import { renderProductOverview } from "../../../product/overview.js";
import { layout } from "../html.js";

export function systemPage() {
  const body = renderProductOverview(
    readFileSync("docs/CURRENT.md", "utf8"),
    "/assets/product-loop.svg",
    "site",
  );
  return {
    route: "system",
    html: layout(
      {
        path: "/system/",
        title: "The whole loop — Design System Contracts",
        description:
          "Current architecture, actual capabilities and outcome-first work order for deterministic code and canvas conversion.",
        mainClass: "product-overview",
      },
      `<article>${body}</article>`,
    ),
  };
}
