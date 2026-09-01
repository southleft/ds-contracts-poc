/**
 * Shared mapping helpers for the fixture reader (docs/35 Phase 1–2).
 */
import type { FactMapping } from "./reader.js";

export type Read = {
  combo: string;
  interaction?: string;
  part: string;
  pseudo?: string;
  channel: string;
};

export const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: Read,
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;

export const receipt = (path: string, why: string, evidence: string): FactMapping => ({
  path,
  receipt: why,
  evidence,
});

export const receiptAll = (
  paths: string[],
  why: string,
  evidence: string,
): FactMapping[] => paths.map((path) => receipt(path, why, evidence));

export const styleForWeight = (w: number): string =>
  ({ 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold" })[w] ?? `W${w}`;

export const firstFam = (raw: Record<string, string>): string =>
  raw.v.split(",")[0].trim().replace(/^["']|["']$/g, "");

/** rgba color × an opacity channel → #rrggbbaa (MUI Switch track baking). */
export const inkTimesOpacity = (raw: Record<string, string>): string => {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(raw.c);
  if (!m) throw new Error(`not rgb()/rgba(): ${raw.c}`);
  const a = (m[4] === undefined ? 1 : Number(m[4])) * Number(raw.o);
  const h = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${h(Number(m[1]))}${h(Number(m[2]))}${h(Number(m[3]))}${h(Math.round(a * 255))}`;
};

export const FONT_PIN =
  "the capture PINS token.fontFamily to the Roboto stack (FC-FONT-SUBSTRATE closure) — the ledger's font-family is the mount pin, not the library's declared '-apple-system, …' stack the fixture cites";
