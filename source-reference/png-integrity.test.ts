import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { validPngDigest } from "./png-integrity.js";
import { recordedStoryUrl } from "./binding-evidence.js";

test("repeated exact PNG bytes reuse only format validation; mutated bytes, CRC and allocation attacks still refuse", () => {
  const originalRead = PNG.sync.read;
  let reads = 0;
  PNG.sync.read = (...args) => {
    reads++;
    return originalRead(...args);
  };
  try {
    const image = new PNG({ width: 2, height: 2 });
    image.data.fill(193);
    const bytes = PNG.sync.write(image);
    const expected = createHash("sha256").update(bytes).digest("hex");
    assert.equal(validPngDigest(bytes), expected);
    assert.equal(validPngDigest(Buffer.from(bytes)), expected);
    assert.equal(reads, 1);
    const damaged = Buffer.from(bytes);
    damaged[damaged.length - 1] ^= 1;
    assert.throws(() => validPngDigest(damaged));
    assert.equal(reads, 2);
    assert.throws(() => validPngDigest(damaged));
    assert.equal(reads, 3, "failures are not cached");
    const huge = Buffer.from(bytes);
    huge.writeUInt32BE(100000, 16);
    huge.writeUInt32BE(100000, 20);
    assert.throws(() => validPngDigest(huge));
    assert.equal(reads, 3, "allocation bound remains before decode");
    for (let n = 0; n < 129; n++) {
      image.data.fill(n);
      validPngDigest(PNG.sync.write(image));
    }
    const before = reads;
    assert.equal(validPngDigest(bytes), expected);
    assert.equal(
      reads,
      before + 1,
      "cache is bounded; evicted data is validated again",
    );
  } finally {
    PNG.sync.read = originalRead;
  }
});

test("archive URL reuse is bound to all bytes and story; changed origins, ambiguous entries and other stories refuse after warming", () => {
  const story = "atoms-checkbox--default";
  const archive = (url: string) =>
    Buffer.from(
      JSON.stringify({
        log: { entries: [{ request: { method: "GET", url } }] },
      }),
    );
  const a = archive(
    "http://127.0.0.1:6017/iframe.html?id=" + story + "&viewMode=story",
  );
  assert.equal(
    recordedStoryUrl(a, story),
    recordedStoryUrl(Buffer.from(a), story),
  );
  const b = archive(
    "http://localhost:6006/iframe.html?id=" + story + "&viewMode=story",
  );
  assert.match(recordedStoryUrl(b, story), /^http:\/\/localhost:6006/);
  assert.throws(() => recordedStoryUrl(a, "different-story"), /not-unique/);
  assert.throws(
    () =>
      recordedStoryUrl(
        archive(
          "https://example.com/iframe.html?id=" + story + "&viewMode=story",
        ),
        story,
      ),
    /origin-refused/,
  );
  const duplicate = JSON.parse(a.toString());
  duplicate.log.entries.push(JSON.parse(b.toString()).log.entries[0]);
  assert.throws(
    () => recordedStoryUrl(Buffer.from(JSON.stringify(duplicate)), story),
    /not-unique/,
  );
});
