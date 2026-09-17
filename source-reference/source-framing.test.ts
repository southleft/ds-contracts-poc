import { nativeImageFraming } from '../playground/src/native-image-framing.js';
import { collectExpectedNativeImages } from './native-operation-images.js';
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import {
  cropSourceFrame,
  measureSourceFrame,
  createSourceFramingStore,
  type SourceFrameInput,
} from "./source-framing.js";
import { captureReference } from "./replay.js";
import { watchSourceFailures } from "./observe.js";
const sha = (b: Buffer | string) =>
  createHash("sha256").update(b).digest("hex");
function sourceImage() {
  const p = new PNG({ width: 40, height: 30 });
  for (let y = 0; y < 30; y++)
    for (let x = 0; x < 40; x++) {
      const i = (y * 40 + x) * 4;
      p.data.set([x, y, x + y, 255], i);
    }
  return PNG.sync.write(p);
}

test("fractional framing preserves every enclosed original pixel without scaling, including context at page edges", () => {
  const bytes = sourceImage(),
    bounds = { x: 10.71875, y: 8, width: 12.5625, height: 10 };
  const result = cropSourceFrame(bytes, bounds),
    crop = PNG.sync.read(result.bytes),
    original = PNG.sync.read(bytes);
  assert.deepEqual(result.crop, { x: 2, y: 0, width: 30, height: 26 });
  for (let y = 0; y < crop.height; y++)
    for (let x = 0; x < crop.width; x++)
      assert.deepEqual(
        crop.data.subarray(
          (y * crop.width + x) * 4,
          (y * crop.width + x + 1) * 4,
        ),
        original.data.subarray((y * 40 + x + 2) * 4, (y * 40 + x + 3) * 4),
      );
  assert.deepEqual(
    cropSourceFrame(bytes, { x: 0, y: 0, width: 1.5, height: 1.5 }).crop,
    { x: 0, y: 0, width: 10, height: 10 },
  );
  for (const invalid of [
    { ...bounds, x: -1 },
    { ...bounds, width: NaN },
    { ...bounds, width: 0 },
    { ...bounds, x: 39 },
  ])
    assert.throws(() => cropSourceFrame(bytes, invalid), /bounds-invalid/);
});

test("saved framing is immutable, deduplicated, source-bound and recoverable without replay; changed input and symlinks fail closed", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "framing-store-"));
  try {
    const harPath = path.join(dir, "source.har");
    writeFileSync(harPath, "archive");
    const source = sourceImage();
    let value: SourceFrameInput = {
      source,
      sourceSha256: sha(source),
      harPath,
      harSha256: sha("archive"),
      url: "http://localhost/iframe.html",
      profile: {
        id: "fixture",
        path: ["button"],
        provenance: "test",
        fontFamily: "Arial",
        requiredStyles: {},
        requiredTokens: {},
      },
    };
    let calls = 0,
      release!: () => void;
    const store = createSourceFramingStore(
      dir,
      () => value,
      async () => {
        calls++;
        await new Promise<void>((resolve) => (release = resolve));
        return { x: 10.5, y: 8, width: 12.5, height: 10 };
      },
    );
    const a = store.create("run", "story"),
      b = store.create("run", "story");
    assert.equal(calls, 1);
    assert.equal(store.running, true);
    release();
    const [first, second] = await Promise.all([a, b]);
    assert.deepEqual(first, second);
    assert.equal(store.running, false);
    const reopened = createSourceFramingStore(
      dir,
      () => value,
      async () => {
        throw Error("must-not-replay");
      },
    );
    assert.deepEqual(await reopened.create("run", "story"), first);
    assert.equal(
      sha(reopened.image("run", "story", first.imageSha256)),
      first.imageSha256,
    );
    assert.throws(
      () => reopened.image("run", "story", "0".repeat(64)),
      /unavailable/,
    );
    writeFileSync(harPath, "changed");
    assert.throws(() => reopened.read("run", "story"), /input-changed/);
    writeFileSync(harPath, "archive");
    const saved = path.join(
      dir,
      "private/source-framing",
      readdirSync(path.join(dir, "private/source-framing"))[0],
    );
    writeFileSync(
      saved,
      JSON.stringify({ ...first, bounds: { ...first.bounds, x: 1 } }),
    );
    assert.throws(() => reopened.read("run", "story"), /record-changed/);
    rmSync(saved);
    symlinkSync(harPath, saved);
    assert.throws(() => reopened.read("run", "story"), /record-invalid/);
    rmSync(saved);
    const racing = createSourceFramingStore(
      dir,
      () => value,
      async () => {
        value = { ...value, sourceSha256: "0".repeat(64) };
        return { x: 1, y: 1, width: 3, height: 3 };
      },
    );
    await assert.rejects(racing.create("run", "story"), /input-changed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("framing measures the exact archived shadow-root target with no live server and rejects a changed original", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "framing-browser-"));
  const server = createServer((req, res) => {
    if (req.url === "/font.woff2") {
      res.setHeader("Content-Type", "font/woff2");
      res.end(
        readFileSync(
          "extract/computed/fonts/ibm-plex-sans/IBMPlexSans-Regular.woff2",
        ),
      );
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<style>@font-face{font-family:"IBM Plex Sans";src:url(/font.woff2)}body{margin:0;background:#222;--accent:#123456}</style><x-fixture></x-fixture><script>customElements.define('x-fixture',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<style>button{position:absolute;left:10.71875px;top:20px;width:72.5625px;height:40px;font:16px "IBM Plex Sans";box-sizing:border-box;background:rgb(10,20,30)}</style><button>Label</button>'}})</script>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`,
    harPath = path.join(dir, "source.har");
  const profile = {
    id: "fixture",
    path: ["x-fixture", "button"],
    provenance: "source-framing.test.ts",
    fontFamily: "IBM Plex Sans",
    requiredStyles: { "background-color": "rgb(10, 20, 30)" },
    requiredTokens: { "--accent": "#123456" },
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 900, height: 600 },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      serviceWorkers: "block",
      recordHar: { path: harPath, content: "embed", mode: "full" },
    });
    const page = await context.newPage(),
      failures = watchSourceFailures(page);
    await page.goto(url);
    const original = await captureReference(page, profile, failures);
    assert.equal(original.status, "valid", original.problems.join(","));
    failures.dispose();
    await context.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const input = {
      source: original.screenshot,
      sourceSha256: original.secondSha256,
      harPath,
      harSha256: sha(readFileSync(harPath)),
      url,
      profile,
    };
    const bounds = await measureSourceFrame(input);
    assert.deepEqual(bounds, {
      x: 10.71875,
      y: 20,
      width: 72.5625,
      height: 40,
    });
    const changed = PNG.sync.read(input.source);
    changed.data[0] ^= 255;
    const changedBytes = PNG.sync.write(changed);
    await assert.rejects(
      measureSourceFrame({
        ...input,
        source: changedBytes,
        sourceSha256: sha(changedBytes),
      }),
      /replay-changed|original-not-reproduced/,
    );
  } finally {
    server.close();
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('native shadow bounds align logical origins without rescaling or cropping either image',()=>{
 const pixels=PNG.sync.write(new PNG({width:364,height:204}));
 const input={operation:{id:'comparison',fileKey:'file'},planRevision:'sha256:'+ 'a'.repeat(64)};
 const raw={version:1,status:'native-readback-collected',receiptKind:'independent-native-component-readback',
  operationId:input.operation.id,fileKey:input.operation.fileKey,planRevision:input.planRevision,acceptedContract:null,nativeQualification:'unqualified',problems:[],
  nodes:[{id:'instance',values:{width:360,height:200}}],images:[{caseId:'card',nodeId:'instance',pngBase64:pixels.toString('base64'),
   exportBounds:{layout:{x:100,y:100,width:360,height:200},render:{x:98,y:99,width:364,height:204}}}]};
 const read=()=>collectExpectedNativeImages(input,[{id:'card',instanceId:'instance'}],raw);
 const actual=read();assert.equal(actual.observation.status,'collected');
 const image=actual.observation.images[0];assert.deepEqual(image.layoutOffset,{x:2,y:1});
 const text={id:'text',type:'TEXT',parentId:'instance',values:{width:94,fontSize:14,characters:'Save changes',fontName:{family:'Inter',style:'Medium'}}};
 (raw.nodes as any[]).push(text,{...text,id:'foreign',parentId:'other'}, {...text,id:'cycle',parentId:'cycle'});
 assert.deepEqual(read().observation.images[0].textBoxes,[{nodeId:'text',text:'Save changes',width:94,family:'Inter',style:'Medium',size:14}],
  'only text in the exported instance is compared; foreign nodes and cycles never match');
 assert.equal(actual.bytes.get(image.sha256)!.equals(pixels),true,'pixels remain the original native export');
 const frame={bounds:{x:32,y:40,width:360,height:200},crop:{x:24,y:32,width:376,height:216}} as import('./source-framing.js').SourceFrame;
 assert.deepEqual(nativeImageFraming(frame,image),{source:{paddingLeft:0,paddingTop:0},native:{paddingLeft:6,paddingTop:7}});
 assert.deepEqual(nativeImageFraming(frame,{...image,layoutOffset:{x:16,y:20}}),{source:{paddingLeft:8,paddingTop:12},native:{paddingLeft:0,paddingTop:0}});
 raw.images[0].exportBounds.render.width=363;
 assert.equal(read().observation.images[0].layoutOffset,undefined,'unknown raster bounds do not invent alignment');
 raw.images[0].exportBounds.render.x=NaN;
 assert.equal(read().observation.status,'unavailable');
});
