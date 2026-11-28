/** A declared capture closure must contain the component payloads it claims. */
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function assertCapturedClosure(dump: Record<string, unknown>): void {
  const raw = object(dump._provenance) ? dump._provenance.closure : undefined;
  if (raw === undefined) return;
  const fail = (why: string): never => { throw Error('FIGMA_CAPTURE_CLOSURE_INCOMPLETE:' + why); };
  if (!object(raw) || raw.rule !== 'follow-instances' || !Number.isInteger(raw.cap) || (raw.cap as number) < 0 ||
      !Array.isArray(raw.requested) || !Array.isArray(raw.pulled) || !Array.isArray(raw.unresolved) || !Array.isArray(raw.cycles)) return fail('invalid closure');
  const seen = new Set<string>();
  for (const claim of [...raw.requested, ...raw.pulled]) {
    if (!object(claim) || typeof claim.nodeId !== 'string' || !claim.nodeId.trim() ||
        typeof claim.name !== 'string' || !claim.name.trim() || !['COMPONENT', 'COMPONENT_SET'].includes(String(claim.type)) || seen.has(claim.nodeId)) return fail('invalid or duplicate claim');
    seen.add(claim.nodeId);
    const matches = Object.entries(dump).filter(([key, value]) => !key.startsWith('_') && object(value) && value.nodeId === claim.nodeId);
    if (matches.length !== 1) return fail(claim.name + ': missing or duplicate component payload');
    const [key, value] = matches[0] as [string, Record<string, unknown>];
    if (key !== claim.name || value.setName !== claim.name || value.type !== claim.type || !Array.isArray(value.variants)) return fail(claim.name + ': component identity differs');
  }
}
