import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPluginZip } from "../scripts/build-plugin-zip.mjs";
import { createReferenceService } from "../source-reference/service.js";
import { createReactLibraryService } from "./server/react-library.js";

const playgroundRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(playgroundRoot, "..");
const sourceReferences: PluginOption = {
  name: "ds-source-references",
  configureServer(server) {
    // These shared inputs live outside Vite's playground root. Watch them
    // explicitly so a live architecture page cannot retain an old diagram.
    server.watcher.add([
      resolve(repoRoot, "docs/CURRENT.md"),
      resolve(repoRoot, "docs/assets/product-loop.svg"),
      resolve(repoRoot, "product"),
    ]);
    const service = createReferenceService(repoRoot);
    const library = createReactLibraryService(repoRoot);
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] === '/api/react-library') {
        void library(req, res).catch(() => { res.statusCode = 500; res.end('React library preparation failed.'); });
        return;
      }
      if (!req.url?.startsWith("/api/source-reference")) return next();
      void service.handle(req, res).catch(() => {
        res.statusCode = 500;
        res.end('{"error":"Source validation service failed."}');
      });
    });
    server.httpServer?.once("close", () => service.close());
  },
};

/** Package the Sync Runner dev plugin into public/ so the Figma tab can
 *  serve it as a download. Runs for dev AND build; refuses (fails the
 *  build) when the dump script embedded in the plugin UI has drifted from
 *  extract/figma/dump.plugin.js — see scripts/build-plugin-zip.mjs. */
const pluginZip: PluginOption = {
  name: "ds-contracts-plugin-zip",
  async buildStart() {
    await buildPluginZip();
  },
};

export default defineConfig({
  root: playgroundRoot,
  plugins: [react(), pluginZip, sourceReferences],
  resolve: {
    // Vite does not read tsconfig `paths`: pin the published-package
    // specifiers to their in-repo SOURCE so the engine graph (core/index.ts →
    // packages/core/src → @ds-contracts/schema) carries one schema module,
    // never packages/*/dist.
    alias: {
      "@ds-contracts/core": resolve(
        repoRoot,
        "packages",
        "core",
        "src",
        "index.ts",
      ),
      "@ds-contracts/schema": resolve(
        repoRoot,
        "packages",
        "schema",
        "src",
        "index.ts",
      ),
    },
  },
  server: {
    port: 5181,
    strictPort: true,
    // Vite runs CORS before configureServer middleware. Let the source service
    // handle preflights for its two capability-protected plugin endpoints; keep
    // Vite's default origin policy for every other resource.
    cors: { preflightContinue: true },
    fs: {
      // The playground imports the engine and its data from outside its own
      // root (../core, ../contracts, ../tokens, ../assets, ../src/styles,
      // ../extract) — same convention as the dashboard.
      allow: [repoRoot],
    },
  },
  build: {
    outDir: "dist",
    // The lazy code-import chunk carries the TypeScript compiler (~5 MB, by
    // design — see playground/PLAN.md "Risks"). Don't warn about what is
    // deliberate and lazy-loaded.
    chunkSizeWarningLimit: 6000,
  },
});
