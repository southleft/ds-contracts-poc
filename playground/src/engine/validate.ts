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
import { contractsById, icons, tokenInventory } from './data.js';

export type ValidationResult =
  | { status: 'empty' }
  | { status: 'json-error'; message: string }
  | { status: 'schema-error'; issues: string[] }
  | { status: 'violations'; contract: Contract; contracts: Map<string, Contract>; issues: string[] }
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
    return {
      status: 'schema-error',
      issues: parsed.error.issues.map(
        (i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`,
      ),
    };
  }
  const contract = parsed.data;
  // Imported/edited contracts join the known set so their composition refs
  // (and self-references) resolve the way the repo's contracts do.
  const contracts = new Map(contractsById);
  contracts.set(contract.id, contract);
  const errors: string[] = [];
  validateContract(contract, contracts, errors, icons);
  generateCss(contract, tokenInventory, errors);
  if (errors.length > 0) return { status: 'violations', contract, contracts, issues: errors };
  return { status: 'valid', contract, contracts };
}
