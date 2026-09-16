/** Test-only runtime: bundle the actual generated React and CSS, not a DOM
 * imitation. All generated modules stay in memory. Never used on source pages. */
import path from "node:path";
import { build } from "esbuild";
import ts from "typescript";
import type { Page } from "playwright-core";

export function generatedTypeErrors(name: string, tsx: string): string[] {
  const file = path.resolve(`core/__generated_${name}.tsx`);
  const declarations = path.resolve("core/__generated_styles.d.ts");
  const files = new Map([
    [file, tsx],
    [
      declarations,
      'declare module "*.module.css" { const styles: Record<string, string>; export default styles; }',
    ],
  ]);
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    types: ["react"],
  };
  const host = ts.createCompilerHost(options);
  const originalRead = host.readFile.bind(host);
  const originalExists = host.fileExists.bind(host);
  host.readFile = (file) => files.get(file) ?? originalRead(file);
  host.fileExists = (file) => files.has(file) || originalExists(file);
  host.getSourceFile = (file, languageVersion) => {
    const contents = host.readFile(file);
    return contents === undefined
      ? undefined
      : ts.createSourceFile(file, contents, languageVersion);
  };
  const program = ts.createProgram([...files.keys()], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

export async function mountGenerated(
  page: Page,
  name: string,
  tsx: string,
  css = "",
  dependencies: Record<string, { tsx: string; css?: string }> = {},
) {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {flushSync} from 'react-dom'; import {${name}} from 'generated-subject';
      const root=createRoot(document.getElementById('root'));
      window.renderSubject=(props)=>flushSync(()=>root.render(React.createElement(${name},props)));
      window.renderSubject({});`,
      resolveDir: process.cwd(),
      sourcefile: "render-subject.tsx",
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outfile: "subject.js",
    format: "iife",
    jsx: "automatic",
    plugins: [
      {
        name: "generated-subject",
        setup(builder) {
          builder.onResolve({ filter: /^generated-subject$/ }, () => ({
            path: `${name}.tsx`,
            namespace: "subject",
          }));
          builder.onResolve({ filter: /^\.\.?\/[A-Za-z][\w-]*$/ }, (args) => {
            const dependency = path.basename(args.path);
            return dependencies[dependency] ? { path: `${dependency}.tsx`, namespace: "subject" } : undefined;
          });
          builder.onLoad({ filter: /.*/, namespace: "subject" }, (args) => ({
            contents: args.path === `${name}.tsx` ? tsx : dependencies[path.basename(args.path, '.tsx')].tsx,
            loader: "tsx",
            resolveDir: process.cwd(),
          }));
          builder.onResolve({ filter: /\.module\.css$/ }, (args) => ({
            path: path.basename(args.path),
            namespace: "subject-css",
          }));
          builder.onLoad({ filter: /.*/, namespace: "subject-css" }, (args) => ({
            contents: args.path === `${name}.module.css` ? css : dependencies[path.basename(args.path, '.module.css')]?.css ?? '',
            loader: "local-css",
          }));
        },
      },
    ],
  });
  await page.setContent(
    '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
  );
  const sheet = bundle.outputFiles.find((file) => file.path.endsWith(".css"));
  if (sheet) await page.addStyleTag({ content: sheet.text });
  await page.addScriptTag({
    content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
  });
  return (props: Record<string, unknown>) =>
    page.evaluate((props) => {
      (
        window as unknown as {
          renderSubject(props: Record<string, unknown>): void;
        }
      ).renderSubject(props);
    }, props);
}
