// Barrel re-exports over the shadcn copy-in sources. The capture harness
// emits `import { <importName> } from '@shadcn-sandbox/ui'` and builds with
// the sandbox's own esbuild; these relative paths resolve through the npm
// `file:` symlink to the real vendored files, whose own `@/lib/utils`
// imports resolve via ../tsconfig.json paths (esbuild reads tsconfig paths).
export * from "../src/components/ui/alert";
export * from "../src/components/ui/avatar";
export * from "../src/components/ui/badge";
export * from "../src/components/ui/button";
export * from "../src/components/ui/card";
export * from "../src/components/ui/checkbox";
export * from "../src/components/ui/dialog";
export * from "../src/components/ui/input";
export * from "../src/components/ui/select";
export * from "../src/components/ui/switch";
export * from "../src/components/ui/tabs";
export * from "../src/components/ui/tooltip";
