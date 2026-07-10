/**
 * Contract-editor validation — the same two refusal layers the generator
 * applies, run live: ContractSchema (zod, shown exactly as zod reports) and
 * validateContract + generateCss (the named violations emitReact refuses on).
 */
import {
  ContractSchema,
  generateCss,
  validateContract,
  type Contract,
} from '../../../core/index.js';
import { contractsById, icons } from './data.js';
import type { RefusalIssue } from './refusal-lines.js';
import { activeChildStubs } from './stub-contracts.js';
import { activeTokens } from './token-source.js';

export type ValidationResult =
  | { status: 'empty' }
  | { status: 'json-error'; message: string }
  | { status: 'schema-error'; issues: string[]; details: RefusalIssue[] }
  | {
      status: 'violations';
      contract: Contract;
      contracts: Map<string, Contract>;
      issues: string[];
      details: RefusalIssue[];
    }
  | { status: 'valid'; contract: Contract; contracts: Map<string, Contract> };

export function validateContractText(text: string): ValidationResult {
  if (!text.trim()) return { status: 'empty' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { status: 'json-error', message: e instanceof Error ? e.message : String(e) };
  }
  const parsed = ContractSchema.safeParse(raw);
  if (!parsed.success) {
    // Keep zod's structured paths alongside the display strings — the editor
    // resolves them to lines (refusal-lines.ts) for click-to-scroll.
    const details: RefusalIssue[] = parsed.error.issues.map((i) => ({
      text: `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`,
      path: i.path.filter((p): p is string | number => typeof p !== 'symbol'),
    }));
    return { status: 'schema-error', issues: details.map((d) => d.text), details };
  }
  const contract = parsed.data;
  // Imported/edited contracts join the known set so their composition refs
  // (and self-references) resolve the way the repo's contracts do.
  const contracts = new Map(contractsById);
  contracts.set(contract.id, contract);
  // Auto-proposed child STUBS (labeled provisional in the receipts) fill ids
  // that would otherwise refuse "no contract in scope" — never overriding a
  // repo contract or the contract in the editor (field case: CBDS ds.icon).
  for (const [id, stub] of activeChildStubs()?.stubs ?? []) {
    if (!contracts.has(id)) contracts.set(id, stub);
  }
  const errors: string[] = [];
  validateContract(contract, contracts, errors, icons);
  // The ACTIVE token inventory referees {token.ref}s — with a pasted user
  // tree, refs into repo-only tokens refuse by name (see token-source.ts).
  generateCss(contract, activeTokens().inventory, errors);
  if (errors.length > 0) {
    return {
      status: 'violations',
      contract,
      contracts,
      issues: errors,
      // Generator messages carry no structured path — the line resolver
      // anchors on the offending value the message quotes.
      details: errors.map((text) => ({ text })),
    };
  }
  return { status: 'valid', contract, contracts };
}
