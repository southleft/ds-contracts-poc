/** Source-derived framing for visual review. No native pixels, alignment search,
 * rescaling, acceptance threshold or replacement of recorded source evidence. */
import { createHash, randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  linkSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { PNG } from "pngjs";
import type { SourceProfile } from "./check.js";
import { replayReference } from "./replay.js";

export interface SourceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface SourceFrameInput {
  source: Buffer;
  sourceSha256: string;
  harPath: string;
  harSha256: string;
  url: string;
  profile: SourceProfile;
}
export interface SourceFrame {
  version: 1;
  sourceSha256: string;
  inputSha256: string;
  imageSha256: string;
  bounds: SourceBox;
  crop: SourceBox;
  sourceSize: { width: number; height: number };
  qualification: "unqualified";
}
const sha = (value: Buffer | string) =>
  createHash("sha256").update(value).digest("hex");
const hashPattern = /^[a-f0-9]{64}$/;
export const sourceFrameInputHash = (input: SourceFrameInput) =>
  sha(
    JSON.stringify({
      version: 1,
      sourceSha256: input.sourceSha256,
      harSha256: input.harSha256,
      profile: input.profile,
      url: input.url,
    }),
  );
function png(bytes: Buffer) {
  if (
    bytes.length < 33 ||
    !bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString("ascii", 12, 16) !== "IHDR" ||
    !bytes.readUInt32BE(16) ||
    !bytes.readUInt32BE(20) ||
    bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 16_777_216
  )
    throw Error("source-framing-image-invalid");
  return PNG.sync.read(bytes, { checkCRC: true });
}
/** Enclose every intersecting source pixel; never truncate fractional bounds.
 * Eight pixels of original context retain edges. Overflow/shadows beyond that
 * margin are outside this diagnostic crop; the full original remains available. */
export function cropSourceFrame(source: Buffer, bounds: SourceBox) {
  const original = png(source);
  if (
    !bounds ||
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
    bounds.x < 0 ||
    bounds.y < 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    bounds.x + bounds.width > original.width ||
    bounds.y + bounds.height > original.height
  )
    throw Error("source-framing-bounds-invalid");
  const x = Math.max(0, Math.floor(bounds.x) - 8),
    y = Math.max(0, Math.floor(bounds.y) - 8);
  const right = Math.min(
      original.width,
      Math.ceil(bounds.x + bounds.width) + 8,
    ),
    bottom = Math.min(original.height, Math.ceil(bounds.y + bounds.height) + 8);
  const crop = { x, y, width: right - x, height: bottom - y };
  const output = new PNG({ width: crop.width, height: crop.height });
  PNG.bitblt(original, output, x, y, crop.width, crop.height, 0, 0);
  return {
    bytes: PNG.sync.write(output),
    crop,
    sourceSize: { width: original.width, height: original.height },
  };
}
async function sourceBounds(
  page: Page,
  profile: SourceProfile,
): Promise<SourceBox> {
  return page.evaluate((selectors) => {
    let root: Document | ShadowRoot | null = document,
      element: Element | null = null;
    for (const selector of selectors) {
      const matches: NodeListOf<Element> | undefined =
        root?.querySelectorAll(selector);
      if (!matches || matches.length !== 1)
        throw Error("source-framing-target-not-unique");
      element = matches[0]!;
      root = element.shadowRoot;
    }
    if (!element) throw Error("source-framing-target-missing");
    const box = element.getBoundingClientRect();
    return {
      x: box.x + window.scrollX,
      y: box.y + window.scrollY,
      width: box.width,
      height: box.height,
    };
  }, profile.path);
}
export async function measureSourceFrame(
  input: SourceFrameInput,
): Promise<SourceBox> {
  if (
    sha(input.source) !== input.sourceSha256 ||
    sha(readFileSync(input.harPath)) !== input.harSha256
  )
    throw Error("source-framing-input-changed");
  const browser = await chromium.launch({ headless: true });
  try {
    const replay = await replayReference(
      browser,
      input.harPath,
      input.url,
      input.profile,
      undefined,
      async (page) => {
        const before = await sourceBounds(page, input.profile);
        const image = await page.screenshot({
          fullPage: true,
          caret: "initial",
        });
        const after = await sourceBounds(page, input.profile);
        if (
          sha(image) !== input.sourceSha256 ||
          JSON.stringify(before) !== JSON.stringify(after)
        )
          throw Error("source-framing-replay-changed");
        return before;
      },
    );
    if (
      replay.status !== "valid" ||
      replay.firstSha256 !== input.sourceSha256 ||
      replay.secondSha256 !== input.sourceSha256 ||
      !replay.inspection ||
      sha(readFileSync(input.harPath)) !== input.harSha256
    )
      throw Error("source-framing-original-not-reproduced");
    return replay.inspection;
  } finally {
    await browser.close();
  }
}
/** Immutable supplemental metadata. Crop bytes are always derived again from
 * the hash-matching original. No arbitrary artifact paths or HAR downloads. */
export function createSourceFramingStore(
  repoRoot: string,
  load: (run: string, story: string) => SourceFrameInput,
  measure = measureSourceFrame,
) {
  const root = path.join(repoRoot, "private", "source-framing");
  let active: { key: string; promise: Promise<SourceFrame> } | undefined;
  function directory(create = false) {
    for (const p of [repoRoot, path.join(repoRoot, "private"), root]) {
      try {
        if (!lstatSync(p).isDirectory())
          throw Error("source-framing-directory-invalid");
      } catch (e) {
        if (
          create &&
          p !== repoRoot &&
          (e as NodeJS.ErrnoException).code === "ENOENT"
        )
          mkdirSync(p, { mode: 0o700 });
        else throw e;
      }
    }
  }
  function input(run: string, story: string) {
    const value = load(run, story);
    if (
      !hashPattern.test(value.sourceSha256) ||
      !hashPattern.test(value.harSha256) ||
      sha(value.source) !== value.sourceSha256 ||
      sha(readFileSync(value.harPath)) !== value.harSha256
    )
      throw Error("source-framing-input-changed");
    return value;
  }
  function read(value: SourceFrameInput): SourceFrame | null {
    try {
      directory();
      const key = sourceFrameInputHash(value),
        file = path.join(root, key + ".json");
      if (!lstatSync(file).isFile())
        throw Error("source-framing-record-invalid");
      const record = JSON.parse(readFileSync(file, "utf8")) as SourceFrame;
      const derived = cropSourceFrame(value.source, record.bounds);
      if (
        record.version !== 1 ||
        record.inputSha256 !== key ||
        record.sourceSha256 !== value.sourceSha256 ||
        record.qualification !== "unqualified" ||
        record.imageSha256 !== sha(derived.bytes) ||
        JSON.stringify(record.crop) !== JSON.stringify(derived.crop) ||
        JSON.stringify(record.sourceSize) !== JSON.stringify(derived.sourceSize)
      )
        throw Error("source-framing-record-changed");
      return record;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  return {
    get running() {
      return !!active;
    },
    read(run: string, story: string) {
      return read(input(run, story));
    },
    image(run: string, story: string, hash: string) {
      const value = input(run, story),
        record = read(value);
      if (!record || record.imageSha256 !== hash)
        throw Error("source-framing-image-unavailable");
      return cropSourceFrame(value.source, record.bounds).bytes;
    },
    async create(run: string, story: string): Promise<SourceFrame> {
      const value = input(run, story),
        key = sourceFrameInputHash(value),
        existing = read(value);
      if (existing) return existing;
      if (active) {
        if (active.key === key) return active.promise;
        throw Error("source-framing-busy");
      }
      const promise = (async () => {
        const bounds = await measure(value),
          derived = cropSourceFrame(value.source, bounds);
        if (sourceFrameInputHash(input(run, story)) !== key)
          throw Error("source-framing-input-changed");
        const record: SourceFrame = {
          version: 1,
          sourceSha256: value.sourceSha256,
          inputSha256: key,
          imageSha256: sha(derived.bytes),
          bounds,
          crop: derived.crop,
          sourceSize: derived.sourceSize,
          qualification: "unqualified",
        };
        directory(true);
        const temporary = path.join(root, randomUUID() + ".tmp");
        try {
          writeFileSync(temporary, JSON.stringify(record) + "\n", {
            flag: "wx",
            mode: 0o600,
          });
          directory();
          // In-process requests are deduplicated. Do not overwrite any prior
          // result that appeared while the browser was measuring.
          const prior = read(value);
          if (prior) return prior;
          linkSync(temporary, path.join(root, key + ".json"));
          return record;
        } finally {
          try {
            unlinkSync(temporary);
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
          }
        }
      })();
      active = { key, promise };
      try {
        return await promise;
      } finally {
        active = undefined;
      }
    },
  };
}
