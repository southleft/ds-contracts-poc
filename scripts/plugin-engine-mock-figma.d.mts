/** Types for scripts/plugin-engine-mock-figma.mjs (imported by
 *  extract/figma/roundtrip-uui/run.ts). The mock's node surface is the
 *  Plugin-API subset the emitted sync scripts touch — typed loosely here
 *  (consumers walk it structurally); see the .mjs header for fidelity notes. */

export interface MockNode {
  type: string;
  id: string;
  key: string;
  name: string;
  parent: MockNode | null;
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fills: unknown[];
  strokes: unknown[];
  strokeWeight: number;
  effects: unknown[];
  cornerRadius: number;
  layoutMode: string;
  primaryAxisAlignItems: string;
  counterAxisAlignItems: string;
  primaryAxisSizingMode: string;
  counterAxisSizingMode: string;
  itemSpacing: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  layoutSizingHorizontal: string;
  layoutSizingVertical: string;
  layoutPositioning: string;
  minWidth: number | null;
  maxWidth: number | null;
  minHeight: number | null;
  maxHeight: number | null;
  boundVariables: Record<string, { type: string; id: string }>;
  componentPropertyReferences: Record<string, string>;
  variantProperties?: Record<string, string> | null;
  children?: MockNode[];
  characters?: string;
  fontSize?: number;
  fontName?: { family: string; style: string };
  lineHeight?: { unit: string; value?: number };
  textStyleId?: string;
  componentProperties?: Record<string, { type: string; value: unknown }>;
  pointCount?: number;
  getSharedPluginData(namespace: string, key: string): string;
  setSharedPluginData(namespace: string, key: string, value: string): void;
  findOne(cb: (n: MockNode) => boolean): MockNode | null;
  findAll(cb?: (n: MockNode) => boolean): MockNode[];
  /** Extra fields the mock reflects dynamically (setBoundVariable value
   *  reflection: topLeftRadius, …). */
  [extra: string]: unknown;
}

export interface MockVariable {
  id: string;
  name: string;
  resolvedType: string;
  valuesByMode: Record<string, unknown>;
  resolveForConsumer(consumer?: unknown): { resolvedType: string; value: unknown } | null;
}

export declare function createFigmaMock(): {
  figma: {
    root: MockNode;
    currentPage: MockNode;
    variables: { getLocalVariablesAsync(): Promise<MockVariable[]> };
    getLocalTextStylesAsync(): Promise<Array<{ id: string; name: string }>>;
    [extra: string]: unknown;
  };
  root: MockNode;
  firstPage: MockNode;
  variables: MockVariable[];
  collections: unknown[];
  styles: Array<{ id: string; name: string }>;
};
