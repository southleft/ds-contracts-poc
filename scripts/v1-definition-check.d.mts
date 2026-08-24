// Type surface of scripts/v1-definition-check.mjs for the TypeScript readers
// (scripts/v1-readiness.ts). Keep in step with the .mjs exports.
export const DOCUMENT_PATH: string;
export const REQUIREMENT_IDS: readonly string[];
export interface RequirementRow {
  id: string;
  requirement: string;
  acceptance: string;
  line: number;
}
export function splitMarkdownRow(line: string): string[];
export function parseRequirementTables(markdown: string): RequirementRow[];
export function githubAnchor(heading: string): string;
export function markdownAnchors(markdown: string): Set<string>;
