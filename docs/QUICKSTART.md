# Your Figma component set → an installed React library

**Technical preview.** A live URL → empty-installed CLI → clean React/Vite consumer run passed on one known Scratch family: one variant at 1.12% on white and black, with its parent, child and label rendered without browser errors. Your own set is checked when you run it; arbitrary-file coverage, unseen success, reverse conversion and beta readiness remain unproved.

## Install and generate

Use macOS or Linux, npm and Node 20.19+ on the 20.x line or 22.12+. You need the supplied CLI archive, a Figma component-set URL you can read, authentic local fonts, and **FIGMA_TOKEN** set privately in your environment with File content: read access. npm/Figma network access is required. npm's `latest` 0.4.0 and `next` 0.5.0-rc.1 do not supply this candidate's command; install the supplied 0.5.0-rc.3 archive.

Start in an empty directory. Replace these three input paths/values; keep the URL's `node-id` from Figma's **Copy link to selection**.

```bash
export CLI_ARCHIVE="/absolute/path/to/supplied-cli.tgz"
export COMPONENT_SET_URL="<your component-set link>"
export FONT_MANIFEST="/absolute/path/to/fonts.json"
mkdir ds-contracts-try
cd ds-contracts-try
npm init -y
npm install "$CLI_ARCHIVE"
node node_modules/@ds-contracts/cli/dist/cli.js figma-to-react --help
node node_modules/playwright-core/cli.js install chromium
node node_modules/@ds-contracts/cli/dist/cli.js figma-to-react --url "$COMPONENT_SET_URL" --out ./out --name @your-team/figma-component --fonts "$FONT_MANIFEST"
```

The candidate pins Playwright 1.61.1. Linux may need `install --with-deps chromium` for system libraries. Each font manifest face uses its actual family, weight, style, local file and SHA-256; paths are relative to the manifest or absolute. Include every face your set uses. For example:

```json
{"version":1,"fonts":[{"family":"Inter","weight":"100 900","style":"normal","file":"./fonts/Inter.woff2","sha256":"<64 lowercase hexadecimal SHA-256 characters>"}]}
```

## Read the result

`out/result.json` names proposal limitations, skipped dependencies, the actual component export and each variant's verdict. The capture, request, package and ordinary check receipts/images are retained in `out`.

- **PASS:** current content/image checks passed, including the 5% limit on white and black, size within 2 px, source text/icons and available declared fonts.
- **FAIL:** a named check failed; exit 1. A package may still exist.
- **UNVERIFIED / NOT VERIFIED:** an observation could not be measured; this is not a pass.
- **NOT CHECKED:** no Chromium comparison; an archive is written and the command currently exits 0.

A written package or zero exit alone is not a fidelity pass. Variable names require Variables: read; without it, the importer names the limitation and uses resolved values. Font assets authenticate consumer bytes, not Figma's exact font bytes. Use a fresh output directory for another run. Read [known limitations](23-known-limitations.md) and [font details](PREVIEW.md#check-with-your-fonts).

## Install in your app, or make a clean consumer

In an existing React 18+ app with CSS Modules support, install the archive path printed above. Import its actual named export from `@your-team/figma-component`, using the archive README and installed declarations for its props. The root import supplies tokens/CSS and generated dependencies; load your authentic fonts separately.

```bash
npm install /absolute/path/to/your-generated-package.tgz
```

**Optional clean consumer:** the versions/config below already built successfully in the measured run. From `ds-contracts-try`, create the files without a scaffolder:

```bash
node --input-type=module <<'JS'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const result=JSON.parse(fs.readFileSync('out/result.json','utf8'));
const dir='consumer'; fs.mkdirSync(dir); fs.mkdirSync(`${dir}/public/fonts`,{recursive:true});
const write=(file,text)=>fs.writeFileSync(`${dir}/${file}`,text);
write('package.json',JSON.stringify({name:'private-test-consumer',private:true,type:'module',scripts:{build:'tsc --noEmit && vite build',preview:'vite preview --host 127.0.0.1 --port 18775 --strictPort'},dependencies:{react:'19.2.7','react-dom':'19.2.7','@your-team/figma-component':`file:../out/${result.tarball}`},devDependencies:{'@types/react':'19.2.17','@types/react-dom':'19.2.3',typescript:'6.0.3',vite:'8.3.0'}}));
write('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',lib:['ES2022','DOM','DOM.Iterable'],module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',types:['vite/client'],strict:true,noEmit:true,skipLibCheck:true},include:['main.tsx']}));
write('index.html','<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Installed React component</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
write('main.tsx',`import { createRoot } from 'react-dom/client';
import { ${result.component} as Generated } from '@your-team/figma-component';
import './consumer.css';
createRoot(document.getElementById('root')!).render(<main><Generated /></main>);
`);
const manifest=path.resolve(process.env.FONT_MANIFEST);
const fonts=JSON.parse(fs.readFileSync(manifest,'utf8')).fonts;
const faces=fonts.map((font,i)=>{
  const bytes=fs.readFileSync(path.resolve(path.dirname(manifest),font.file));
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==font.sha256) throw Error('Font hash changed');
  const file=`${i}${path.extname(font.file)}`; fs.writeFileSync(`${dir}/public/fonts/${file}`,bytes);
  return `@font-face { font-family: ${JSON.stringify(font.family)}; font-weight: ${font.weight}; font-style: ${font.style}; src: url('/fonts/${file}'); }`;
});
write('consumer.css',`${faces.join(String.fromCharCode(10))}
body { margin: 0; background: white; }
main { padding: 32px; }
`);
JS
cd consumer
npm install
npm run build
npm run preview
```

Open [the clean consumer](http://127.0.0.1:18775/). The example starts with your component's default inputs; add any required props named by its declarations to `main.tsx`, then rebuild. Edit the consumer, not generated files. Installation/rendering and checked fidelity remain separate. Report `result.json`, named refusals and what you saw; exclude your token. Keyboard/accessibility behavior beyond the declared generated API remains unqualified.

[More usage examples](USER-JOURNEYS.md#designer-first). [React → Figma source setup](../source-reference/README.md) is a separate unqualified configured-workspace path.

_Verified on macOS by a fresh agent from an empty directory with the supplied archive, known Scratch component-set URL and authentic font manifest: CLI check 1 PASS, clean React install/build passed. One sandbox network retry was needed; the command recipe needed no correction. Linux setup, other files and release qualification remain open._
