/**
 * The schema-level validateContract referee — everything checkable from the
 * contract DOCUMENTS alone: schema validity (named Zod issues), identity
 * uniqueness (duplicate ids/names), and the composition graph (unknown refs,
 * cycles) via the same sortByDependencies gate the generators run.
 *
 * Scope note (deliberate): the DEEP referee — anatomy part rules, token
 * placeholder substitution, icon assets, per-part channel conflicts — needs
 * the token inventory and the icon set, so it lives with the emitters
 * (core/emit-react.ts validateContract). This package referees the
 * contract as a DOCUMENT; the emitters referee it as a BUILD INPUT.
 */
import { ContractSchema, sortByDependencies, type Contract } from './contract-schema.js';

export interface ValidateResult {
  ok: boolean;
  /** Present iff ok. */
  contract?: Contract;
  /** Named violations — empty iff ok. */
  errors: string[];
}

/** Referee ONE contract document against the schema. */
export function validateContract(raw: unknown): ValidateResult {
  const parsed = ContractSchema.safeParse(raw);
  if (parsed.success) return { ok: true, contract: parsed.data, errors: [] };
  const id =
    typeof raw === 'object' && raw !== null && typeof (raw as { id?: unknown }).id === 'string'
      ? (raw as { id: string }).id
      : '(no id)';
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => `${id}: ${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

export interface ValidateSetResult {
  ok: boolean;
  /** Schema-valid contracts in DEPENDENCY ORDER when the graph is sound,
   *  declaration order otherwise. */
  contracts: Contract[];
  errors: string[];
}

/** Referee a SET of contract documents: per-document schema validity, then
 *  the identity gates (duplicate id / duplicate name), then the composition
 *  graph (unknown component refs, cycles). Mirrors the generator's refusal
 *  order — fail fast, name every violation, never guess past one. */
export function validateContractSet(raws: unknown[]): ValidateSetResult {
  const errors: string[] = [];
  const contracts: Contract[] = [];
  for (const raw of raws) {
    const r = validateContract(raw);
    if (r.ok) contracts.push(r.contract!);
    else errors.push(...r.errors);
  }
  const seenIds = new Map<string, string>();
  const seenNames = new Map<string, string>();
  for (const c of contracts) {
    if (seenIds.has(c.id)) {
      errors.push(`${c.id}: duplicate contract id (also declared by "${seenIds.get(c.id)}")`);
    }
    seenIds.set(c.id, c.name);
    if (seenNames.has(c.name)) {
      errors.push(`${c.id}: duplicate contract name "${c.name}" (also used by ${seenNames.get(c.name)})`);
    }
    seenNames.set(c.name, c.id);
  }
  let ordered = contracts;
  if (errors.length === 0) {
    try {
      ordered = sortByDependencies(contracts);
    } catch (err) {
      errors.push(String(err instanceof Error ? err.message : err));
    }
  }
  return { ok: errors.length === 0, contracts: ordered, errors };
}
