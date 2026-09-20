import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import { renderProductOverview } from "./overview.js";
import { systemPage } from "../site/src/pages/system.js";
import { renderJourneyGuide } from "./journeys.js";
import { getStartedPage } from "../site/src/pages/get-started.js";

const read = (file: string) => readFileSync(file, "utf8");
const markdown = read("docs/CURRENT.md");

test("one user guide reaches the current app actions and the site without local-route dead ends", () => {
  const guide = read("docs/USER-JOURNEYS.md");
  const app = renderJourneyGuide(guide, "app");
  const site = renderJourneyGuide(guide, "site");
  assert.ok(getStartedPage().html.includes(`<article>${site}</article>`));
  assert.match(app, /href="\/playground\?source=figma"/);
  assert.match(app, /href="\/playground\?source=code"/);
  assert.match(app, /href="\/sources"/);
  assert.match(
    site,
    /href="https:\/\/ds-contracts-playground.pages.dev\/playground\?source=figma"/,
  );
  assert.match(site, /href="http:\/\/localhost:5181\/sources"/);
  for (const html of [app, site]) {
    for (const anchor of [
      "designer-first",
      "code-first",
      "both-libraries",
      "install",
      "next-delivery",
    ])
      assert.ok(html.includes(`id="${anchor}"`));
    assert.match(html, /Still in development/);
    assert.match(html, /Where this currently stops/);
  }
  assert.match(read("playground/src/pages/Start.tsx"), /USER-JOURNEYS.md\?raw/);
  assert.match(
    read("playground/src/App.tsx"),
    /pathname === "\/start"\) return <Start \/>/,
  );
  assert.match(
    renderJourneyGuide(
      guide.replace("Start with your library", "CHANGED GUIDE"),
      "app",
    ),
    /CHANGED GUIDE/,
  );
});

test("both product surfaces render the canonical document, including its scope and diagram", () => {
  const html = renderProductOverview(markdown, "/assets/product-loop.svg");
  const site = systemPage();
  assert.equal(site.route, "system");
  assert.ok(site.html.includes(`<article>${html}</article>`));
  assert.match(html, /v1 is not complete/i);
  assert.match(html, /does not automatically edit React source/);
  assert.match(html, /src="\/assets\/product-loop.svg"/);
  assert.match(
    html,
    /href="https:\/\/github.com\/southleft\/ds-contracts-poc\/blob\/main\/AGENTS.md"/,
  );
  const app = read("playground/src/pages/System.tsx");
  assert.match(
    app,
    /import overview from ["']\.\.\/\.\.\/\.\.\/docs\/CURRENT.md\?raw["']/,
  );
  assert.match(app, /renderProductOverview\(overview, diagram\)/);
  assert.match(
    read("playground/src/App.tsx"),
    /pathname === "\/system"\) return <System \/>/,
  );
  assert.match(read("site/build.ts"), /systemPage\(\)/);
});

test("new canonical text changes the rendered result; unknown diagrams fail instead of silently breaking", () => {
  const changed = markdown.replace(
    /v1 is not complete/i,
    "TEST: readiness claim changed",
  );
  assert.match(
    renderProductOverview(changed, "/test.svg"),
    /TEST: readiness claim changed/,
  );
  assert.notEqual(
    renderProductOverview(changed, "/test.svg"),
    renderProductOverview(markdown, "/test.svg"),
  );
  assert.throws(
    () => renderProductOverview("![test](assets/missing.svg)", "/test.svg"),
    /Unknown product diagram/,
  );
  assert.match(
    renderProductOverview(
      '![quoted "label"](assets/product-loop.svg)',
      "/safe.svg",
    ),
    /&quot;label&quot;/,
  );
});

test("the implementation map names real source files and current entry points do not reactivate the superseded plan", () => {
  const section = markdown
    .split("### Implementation map")[1]
    .split("## How drift")[0];
  const paths = [...section.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  assert.ok(paths.length >= 10);
  for (const file of paths)
    assert.ok(existsSync(file), `Missing implementation: ${file}`);
  for (const file of [
    "README.md",
    "AGENTS.md",
    "docs/01-architecture.md",
    "docs/35-two-journey-v1-plan.md",
  ]) {
    assert.match(
      read(file),
      /CURRENT.md/,
      `No active direction link in ${file}`,
    );
  }
  for (const file of [
    "home",
    "how",
    "spec",
    "get-started",
    "what-works",
    "cli",
    "contribute",
    "emitters",
  ]) {
    assert.doesNotMatch(
      read(`site/src/pages/${file}.ts`),
      /[Aa]ctive v1 plan:[^\n]*docs\/35/,
    );
  }
});
