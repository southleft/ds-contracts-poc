/**
 * Pins for playground G6 cost routing.
 *   npx tsx --test playground/src/engine/styling-detect.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectStyling } from "./styling-detect.js";

describe("detectStyling", () => {
  it("routes Emotion paste to computed-capture cost panel", () => {
    const r = detectStyling(
      `import styled from '@emotion/styled';\nconst B = styled.button\`color: red\`;\nexport function Button(){ return <B/> }`,
      "",
    );
    assert.equal(r.kind, "emotion");
    assert.equal(r.needsComputedCapture, true);
    assert.ok(r.costLines.length >= 2);
    assert.match(r.cta, /stub anatomy/i);
  });

  it("does not cost-route a CSS Module paste", () => {
    const r = detectStyling(
      `import styles from './Button.module.css';\nexport function Button(){ return <button className={styles.root}/> }`,
      ".root { color: red }",
    );
    assert.equal(r.needsComputedCapture, false);
    assert.equal(r.kind, "css-module");
  });

  it("routes styled-components without css module", () => {
    const r = detectStyling(
      `import styled from 'styled-components';\nconst X = styled.div\`\`;\nexport const C = () => <X/>`,
    );
    assert.equal(r.kind, "styled-components");
    assert.equal(r.needsComputedCapture, true);
  });

  it("leaves plain TSX alone", () => {
    const r = detectStyling(
      `export function Button({label}:{label:string}){ return <button>{label}</button> }`,
    );
    assert.equal(r.kind, "plain");
    assert.equal(r.needsComputedCapture, false);
  });
});
