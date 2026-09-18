/** Source readiness is separate from conversion fidelity and owner approval. */
export interface SourceProfile {
  id: string;
  provenance: string;
  /** Each next selector enters the previous element's open shadow root. */
  path: string[];
  /** A painted text witness may live inside a slotted child's shadow root. */
  fontPath?: string[];
  /** For a textless labelable control, use its one native associated label.
   * Arbitrary nearby text is never a substitute for this relationship. */
  associatedLabelText?: string;
  probes?: Record<string, {
    path: string[];
    styles?: Record<string, string>;
    properties?: Record<string, string | number | boolean>;
  }>;
  requiredStyles: Record<string, string>;
  requiredTokens: Record<string, string>;
  fontFamily: string;
}

export interface SourceObservation {
  found: boolean;
  visible: boolean;
  width: number;
  height: number;
  text: string;
  associatedLabel?: { text: string; visible: boolean; associated: boolean };
  styles: Record<string, string>;
  tokens: Record<string, string>;
  fontsReady: boolean;
  platformFonts: { familyName: string; glyphCount: number }[];
  failedResources: string[];
  runtimeErrors: string[];
  probes?: Record<string, {
    found: boolean;
    visible: boolean;
    styles: Record<string, string>;
    properties: Record<string, string | number | boolean | null>;
  }>;
}

export function checkSource(profile: SourceProfile, observed: SourceObservation) {
  const problems: string[] = [];
  if (!profile.id || !profile.provenance || !profile.path.length ||
      !profile.fontFamily || !Object.keys(profile.requiredStyles).length || !Object.keys(profile.requiredTokens).length) {
    problems.push('profile-incomplete');
  }
  if (!observed.found) problems.push('component-missing');
  if (!observed.visible || !(observed.width > 0) || !(observed.height > 0)) problems.push('component-not-visible');
  if (!observed.text.trim()) problems.push('text-witness-missing');
  if (profile.associatedLabelText !== undefined) {
    if (!profile.associatedLabelText.trim()) problems.push('profile-incomplete');
    if (!observed.associatedLabel?.associated) problems.push('label-association-invalid');
    if (!observed.associatedLabel?.visible) problems.push('label-not-visible');
    if (observed.associatedLabel?.text !== profile.associatedLabelText) problems.push('label-text-mismatch');
  }
  for (const [property, expected] of Object.entries(profile.requiredStyles)) {
    if (observed.styles[property] !== expected) problems.push(`style-mismatch:${property}`);
  }
  for (const [token, expected] of Object.entries(profile.requiredTokens)) {
    const value = observed.tokens[token]?.trim();
    if (!value || value.includes('var(')) problems.push(`theme-token-missing:${token}`);
    else if (value !== expected) problems.push(`theme-token-mismatch:${token}`);
  }
  if (!observed.fontsReady) problems.push('fonts-not-ready');
  const used = observed.platformFonts.filter(f => f.glyphCount > 0);
  if (!used.length || used.some(f => f.familyName !== profile.fontFamily)) problems.push('font-substitution');
  if (observed.failedResources.length) problems.push('resource-failure');
  if (observed.runtimeErrors.length) problems.push('runtime-error');
  for (const [name, probe] of Object.entries(profile.probes ?? {})) {
    const actual = observed.probes?.[name];
    if (!probe.path.length) problems.push(`probe-incomplete:${name}`);
    if (!actual?.found || !actual.visible) problems.push(`probe-not-visible:${name}`);
    for (const [key, value] of Object.entries(probe.styles ?? {})) {
      if (actual?.styles[key] !== value) problems.push(`probe-style-mismatch:${name}:${key}`);
    }
    for (const [key, value] of Object.entries(probe.properties ?? {})) {
      if (actual?.properties[key] !== value) problems.push(`probe-state-mismatch:${name}:${key}`);
    }
  }
  return { status: problems.length ? 'invalid' as const : 'valid' as const, problems };
}
