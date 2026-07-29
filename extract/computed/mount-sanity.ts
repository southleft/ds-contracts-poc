/**
 * MOUNT SANITY — did the capture mount the component, or something else?
 *
 * THE FAILURE THIS EXISTS FOR. Point the capture at a component that needs a
 * trigger (Popover, Dropdown, Tooltip, Menu) and configure no `openDriver`, and
 * the harness renders the ACTIVATOR. Nothing throws. The sweep completes, the
 * fidelity gate scores the activator's channels at whatever they are, and a
 * "Popover contract" ships describing a button. That is the worst class of
 * wrong this project has: it produces a plausible artifact, so a person trusts
 * it and only discovers the lie on canvas.
 *
 * WHY THE OBVIOUS CHECK DOES NOT WORK. The intuitive test — "does the captured
 * root carry a class the component's own name predicts?" — was MEASURED against
 * the committed corpus before this file was written, and it refuses real
 * components:
 *
 *     carbon    Button        0 name-echoing stems (the stem is `btn`)
 *     tailwind  all 5         0 name-echoing stems (classAllow is `^$`)
 *     altitude  7 of 8        0 named stems at all (shadow DOM, no :host rules)
 *     polaris   8 of 12       no echo (`icon`, `label`, `box`, `blockstack`)
 *
 * A check that refuses 8 of Polaris's 12 shipped components to catch one absent
 * one is not a check. It is a way to make people pass `--force`.
 *
 * WHAT DOES WORK, AND THE MEASUREMENT BEHIND IT. Two different components
 * cannot render the same DOM with the same styles. If they do, one of them
 * mounted the other. The fingerprint is the rendered signature chain
 * (`tag|class-stems` per element, in DFS order) joined with the component's
 * whole anatomy — structure AND channel values, not just channel names.
 *
 * Every weaker version of this fingerprint was tried and REJECTED on measured
 * false positives, all of them in the conformance fixture (50 cases that are
 * deliberately near-identical single-div documents — the adversarial input for
 * exactly this check):
 *
 *     structure only ...................... 41 collisions
 *     structure + channel NAMES ........... 17 collisions
 *     structure + channel names + VALUES ... 0 collisions
 *
 * The shipped fingerprint is the third. Across all 104 captured components —
 * six real libraries plus the fixture — it collides ZERO times. That zero is
 * the false-positive evidence, and `mount-sanity` in the eval suite re-proves
 * it on every run rather than trusting this comment.
 *
 * SCOPE-INDEPENDENCE. This check compares components to each other, so it must
 * never write into a component's own artifacts — `capture-scope-independence`
 * proves a component's output is a function of that component ALONE, and a
 * refusal that depended on which siblings shared the sweep would break that
 * guarantee outright. So a finding fails the RUN and is reported at run level;
 * it does not quarantine one component and it does not touch one byte of any
 * component's directory.
 *
 * WHAT IT DOES NOT CATCH — say it plainly, because the gap is real. The
 * collision only fires when the thing that got mounted INSTEAD is also a
 * configured component. Capture a Popover whose activator is a plain `<button>`
 * that no config entry names, and nothing here fires. That residual is named in
 * docs/23-known-limitations.md rather than papered over; the disclosure-prop
 * advisory below is the (weaker, config-time) net under it.
 */
import crypto from 'node:crypto';

export interface MountRow {
  /** Component name as configured. */
  name: string;
  /** `tag|stem.stem` per element in DFS order, joined — the rendered shape. */
  sigChain: string;
  /** The component's anatomy, verbatim. Channel VALUES are load-bearing here. */
  anatomy: unknown;
}

export interface MountFinding {
  /** Stable refusal name — the string a person greps for. */
  name: 'mount-collision';
  components: [string, string];
  message: string;
}

/** Key order is normalized so two anatomies that differ only in serialization
 *  order are the same fingerprint; nothing else about the value is touched. */
const canonical = (n: unknown): unknown => {
  if (Array.isArray(n)) return n.map(canonical);
  if (n && typeof n === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(n as Record<string, unknown>).sort()) out[k] = canonical((n as Record<string, unknown>)[k]);
    return out;
  }
  return n;
};

export const mountFingerprint = (row: MountRow): string =>
  crypto.createHash('sha1').update(JSON.stringify([row.sigChain, canonical(row.anatomy)])).digest('hex').slice(0, 12);

/**
 * Returns one finding per pair of components whose captures are
 * indistinguishable. Empty array = every component rendered something only it
 * renders.
 */
export function mountSanity(rows: MountRow[]): MountFinding[] {
  const seen = new Map<string, string>();
  const out: MountFinding[] = [];
  for (const row of rows) {
    const fp = mountFingerprint(row);
    const prior = seen.get(fp);
    if (prior === undefined) {
      seen.set(fp, row.name);
      continue;
    }
    out.push({
      name: 'mount-collision',
      components: [prior, row.name],
      message:
        `${row.name} and ${prior} produced the IDENTICAL rendered anatomy and the IDENTICAL channel values. ` +
        `Two different components cannot do that — one of them mounted the other. ` +
        `The usual cause is a component that needs a trigger or an open state: with none configured it renders its ` +
        `activator, and the sweep happily measures the activator. Fix the config (openDriver / portalCapture / ` +
        `fixedProps) so ${row.name} actually renders — do NOT ship this contract, it does not describe ${row.name}. ` +
        `The one legitimate way to see this: ${row.name} and ${prior} really ARE the same component under two ` +
        `exported names. Then remove one from the config; do not relax the check.`,
    });
  }
  return out;
}

/** Props whose presence means "this component has a closed state in which it
 *  renders something other than itself". Conventional across React libraries;
 *  used only for an ADVISORY at the review gate, never for a refusal, because
 *  a component can legitimately be captured closed (MUI's Accordion is). */
const DISCLOSURE_PROP = /^(open|active|isOpen|isActive|visible|isVisible|expanded|isExpanded|show|shown|opened)$/;
const ANCHOR_PROP = /^(activator|trigger|anchorEl|anchor|renderTrigger|reference|referenceElement)$/;

export interface DisclosureAdvisory {
  component: string;
  props: string[];
  message: string;
}

/**
 * Config-time advisory: this component's own prop surface says it has a closed
 * state, and the config drives neither `openDriver` nor `portalCapture`. Shown
 * at the `onboard` review gate — the point of that gate is that a person looks
 * before anything is captured.
 */
export function disclosureAdvisory(
  component: string,
  propNames: string[],
  configured: { openDriver?: unknown; portalCapture?: unknown; fixedProps?: Record<string, unknown> },
): DisclosureAdvisory | null {
  const hits = propNames.filter((p) => DISCLOSURE_PROP.test(p) || ANCHOR_PROP.test(p));
  if (hits.length === 0) return null;
  const driven =
    configured.openDriver !== undefined ||
    configured.portalCapture !== undefined ||
    hits.some((h) => configured.fixedProps !== undefined && h in configured.fixedProps);
  if (driven) return null;
  return {
    component,
    props: hits,
    message:
      `${component} declares ${hits.map((h) => `\`${h}\``).join(', ')} but the config drives no open state ` +
      `(no openDriver, no portalCapture, and fixedProps sets none of them). If this component renders its ` +
      `activator when closed, the capture will measure the ACTIVATOR and report success. Check the review ` +
      `screenshot before continuing.`,
  };
}
