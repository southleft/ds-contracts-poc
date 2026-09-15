/**
 * Custom Elements Manifest adapter — the framework-agnostic proof.
 *
 * Web Component libraries (Shoelace, Lit-based systems, FAST, …) already
 * publish `custom-elements.json` (https://custom-elements-manifest.open-wc.org).
 * CEM *describes* an API but never verifies it (docs/08); this adapter reads
 * that description into the same ExtractedComponent shape as the React
 * adapter, so proposals and reconciliation work identically. One adapter,
 * an entire ecosystem of libraries — no per-framework parser needed when a
 * standard manifest exists.
 */
import { readFileSync } from 'node:fs';
import type { SkippedComponent } from '../../core/extract-react-tsx.js';
import type { ExtractedComponent, ExtractedProp } from '../types.js';

interface CemType {
  text?: string;
}
interface CemAttrOrMember {
  name: string;
  kind?: string;
  type?: CemType;
  default?: string;
  description?: string;
  privacy?: string;
}
interface CemEvent {
  /** Published manifests DO ship nameless events (a bare `{ type }` from a
   *  re-dispatched TransitionEvent, say) — optional here so the adapter
   *  degrades to a named skip instead of a TypeError. */
  name?: string;
  type?: CemType;
  description?: string;
}
interface CemDeclaration {
  kind?: string;
  customElement?: boolean;
  name?: string;
  tagName?: string;
  description?: string;
  attributes?: CemAttrOrMember[];
  members?: CemAttrOrMember[];
  events?: CemEvent[];
}
interface CemModule {
  path?: string;
  declarations?: CemDeclaration[];
}

/** Declaration evidence, not a contract or a claim about runtime behavior.
 * Keep source spelling and absence intact: in particular an unset enum is
 * not a fabricated "default" member, and an event is not a renamed callback. */
export interface CemNamedFacts {
  name: string;
  description?: string;
  typeText?: string;
  /** The manifest's source expression, NOT an evaluated/defaulted value. */
  default?: string;
}
export interface CemAttributeFacts extends CemNamedFacts {
  fieldName?: string;
}
export interface CemPropertyFacts extends CemNamedFacts {
  attribute?: string;
  readonly?: boolean;
}
export interface CemDeclarationFacts {
  modulePath: string;
  className: string;
  tagName: string;
  description?: string;
  attributes: CemAttributeFacts[];
  properties: CemPropertyFacts[];
  slots: CemNamedFacts[];
  events: CemNamedFacts[];
  cssParts: CemNamedFacts[];
  cssProperties: CemNamedFacts[];
}
export interface CemProblem {
  code: string;
  /** Stable manifest location; no file access or source execution occurs. */
  path: string;
  message: string;
}
export interface CemDeclarationRead {
  declarations: CemDeclarationFacts[];
  problems: CemProblem[];
}

/** Additive semantic intake. The legacy extractCem projection below deliberately
 * remains unchanged; callers must not mistake its historical inferred props
 * for this exact declaration evidence. Malformed/ambiguous fields are named,
 * never guessed. Valid fields and duplicate entries remain inspectable even
 * when their declaration has problems. */
export function readCemDeclarations(manifest: unknown): CemDeclarationRead {
  const declarations: CemDeclarationFacts[] = [];
  const problems: CemProblem[] = [];
  const locations = new WeakMap<CemNamedFacts, string>();
  const problem = (code: string, path: string, message: string) => problems.push({ code, path, message });
  const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (object: Record<string, unknown>, key: string, path: string, required = false, empty = true): string | undefined => {
    const value = object[key];
    if (value === undefined && !required) return undefined;
    if (typeof value !== 'string' || (!empty && value.trim() === '')) {
      problem('invalid-string', `${path}.${key}`, `Expected ${empty ? 'a string' : 'a non-empty string'}; source identity was not inferred.`);
      return undefined;
    }
    return value;
  };
  const list = (object: Record<string, unknown>, key: string, path: string, required = false): unknown[] => {
    const value = object[key];
    if (value === undefined && !required) return [];
    if (!Array.isArray(value)) {
      problem('invalid-array', `${path}.${key}`, 'Expected an array; no entries were inferred.');
      return [];
    }
    return value;
  };
  const named = (value: unknown, path: string, slot = false): CemNamedFacts | undefined => {
    if (!record(value)) {
      problem('invalid-entry', path, 'Expected a declaration object.');
      return undefined;
    }
    const name = text(value, 'name', path, true, slot);
    if (name === undefined) return undefined;
    const result: CemNamedFacts = { name };
    const description = text(value, 'description', path);
    const defaultValue = text(value, 'default', path);
    if (description !== undefined) result.description = description;
    if (defaultValue !== undefined) result.default = defaultValue;
    if (value.type !== undefined) {
      if (!record(value.type)) problem('invalid-type', `${path}.type`, 'Expected a type object with source text.');
      else {
        const typeText = text(value.type, 'text', `${path}.type`, true, false);
        if (typeText !== undefined) result.typeText = typeText;
      }
    }
    locations.set(result, path);
    return result;
  };
  const checkDuplicates = (entries: CemNamedFacts[], path: string) => {
    const names = new Set<string>();
    entries.forEach((entry, index) => {
      if (names.has(entry.name)) problem('duplicate-name', `${locations.get(entry) ?? `${path}[${index}]`}.name`, `Duplicate identity ${JSON.stringify(entry.name)}; entries were retained, not merged.`);
      names.add(entry.name);
    });
  };
  if (!record(manifest)) {
    problem('invalid-manifest', '$', 'Expected a Custom Elements Manifest object.');
    return { declarations, problems };
  }
  const tags = new Set<string>();
  const classes = new Set<string>();
  list(manifest, 'modules', '$', true).forEach((module, mi) => {
    const mp = `$.modules[${mi}]`;
    if (!record(module)) { problem('invalid-module', mp, 'Expected a module object.'); return; }
    const modulePath = text(module, 'path', mp, true, false);
    list(module, 'declarations', mp).forEach((declaration, di) => {
      const dp = `${mp}.declarations[${di}]`;
      if (!record(declaration)) { problem('invalid-declaration', dp, 'Expected a declaration object.'); return; }
      if (declaration.customElement !== undefined && typeof declaration.customElement !== 'boolean')
        problem('invalid-custom-element', `${dp}.customElement`, 'Expected a boolean declaration marker.');
      // Ordinary utility classes/functions/mixins are not custom elements.
      if (declaration.customElement !== true && declaration.tagName === undefined) return;
      if (declaration.customElement === false)
        problem('conflicting-element-identity', dp, 'tagName is present but customElement is false.');
      if (declaration.kind !== 'class') problem('invalid-element-kind', `${dp}.kind`, 'A custom element must declare kind "class".');
      const className = text(declaration, 'name', dp, true, false);
      const tagName = text(declaration, 'tagName', dp, true, false);
      const description = text(declaration, 'description', dp);
      const attributes: CemAttributeFacts[] = [];
      const properties: CemPropertyFacts[] = [];
      list(declaration, 'attributes', dp).forEach((entry, index) => {
        const ep = `${dp}.attributes[${index}]`;
        const fact = named(entry, ep);
        if (!fact || !record(entry)) return;
        const fieldName = text(entry, 'fieldName', ep, false, false);
        const attribute = { ...fact, ...(fieldName !== undefined ? { fieldName } : {}) };
        locations.set(attribute, ep);
        attributes.push(attribute);
      });
      list(declaration, 'members', dp).forEach((entry, index) => {
        const ep = `${dp}.members[${index}]`;
        if (!record(entry)) { problem('invalid-member', ep, 'Expected a member object.'); return; }
        if (entry.kind !== 'field') {
          if (entry.kind !== 'method') problem('invalid-member-kind', `${ep}.kind`, 'Expected field or method.');
          return;
        }
        if (entry.privacy === 'private' || entry.privacy === 'protected' || entry.static === true) return;
        if (entry.privacy !== undefined && entry.privacy !== 'public') {
          problem('invalid-privacy', `${ep}.privacy`, 'Unknown visibility; member was not admitted as consumer API.'); return;
        }
        if (entry.static !== undefined && typeof entry.static !== 'boolean') {
          problem('invalid-static', `${ep}.static`, 'Unknown static declaration; member was not admitted as consumer API.'); return;
        }
        const fact = named(entry, ep);
        if (!fact) return;
        const attribute = text(entry, 'attribute', ep, false, false);
        const property: CemPropertyFacts = { ...fact, ...(attribute !== undefined ? { attribute } : {}) };
        if (entry.readonly !== undefined) {
          if (typeof entry.readonly === 'boolean') property.readonly = entry.readonly;
          else problem('invalid-readonly', `${ep}.readonly`, 'Expected a boolean readonly declaration.');
        }
        locations.set(property, ep);
        properties.push(property);
      });
      const surfaces = { slots: [], events: [], cssParts: [], cssProperties: [] } as Pick<CemDeclarationFacts, 'slots' | 'events' | 'cssParts' | 'cssProperties'>;
      for (const key of ['slots', 'events', 'cssParts', 'cssProperties'] as const) {
        list(declaration, key, dp).forEach((entry, index) => {
          const fact = named(entry, `${dp}.${key}[${index}]`, key === 'slots');
          if (fact) surfaces[key].push(fact);
        });
        checkDuplicates(surfaces[key], `${dp}.${key}`);
      }
      checkDuplicates(attributes, `${dp}.attributes`);
      checkDuplicates(properties, `${dp}.members`);
      const fields = new Set<string>();
      for (const [index, attribute] of attributes.entries()) {
        if (attribute.fieldName === undefined) continue;
        const ap = locations.get(attribute) ?? `${dp}.attributes[${index}]`;
        if (fields.has(attribute.fieldName)) problem('conflicting-field-mapping', `${ap}.fieldName`, 'Multiple attributes map to the same field; no mapping was selected.');
        fields.add(attribute.fieldName);
        const members = properties.filter(p => p.name === attribute.fieldName);
        if (members.length !== 1) {
          problem('unresolved-field-mapping', `${ap}.fieldName`, 'Expected exactly one public instance field matching fieldName.');
          continue;
        }
        const member = members[0];
        if (member.attribute !== undefined && member.attribute !== attribute.name)
          problem('conflicting-field-mapping', `${ap}.fieldName`, 'Attribute fieldName and member attribute disagree.');
        for (const key of ['typeText', 'default'] as const)
          if (attribute[key] !== undefined && member[key] !== undefined && attribute[key] !== member[key])
            problem('conflicting-field-declaration', ap, `Attribute and member ${key} declarations differ; neither was preferred.`);
      }
      const memberAttributes = new Set<string>();
      for (const [index, member] of properties.entries()) {
        if (member.attribute === undefined) continue;
        const pp = locations.get(member) ?? `${dp}.members[${index}]`;
        if (memberAttributes.has(member.attribute))
          problem('conflicting-attribute-mapping', `${pp}.attribute`, 'Multiple fields map to the same attribute; no field was selected.');
        memberAttributes.add(member.attribute);
        const targets = attributes.filter(a => a.name === member.attribute);
        if (targets.length !== 1 || (targets[0].fieldName !== undefined && targets[0].fieldName !== member.name))
          problem('unresolved-attribute-mapping', `${pp}.attribute`, 'Expected one attribute with a compatible fieldName.');
      }
      if (modulePath === undefined || className === undefined || tagName === undefined) return;
      const classIdentity = JSON.stringify([modulePath, className]);
      if (tags.has(tagName)) problem('duplicate-tag', `${dp}.tagName`, 'Tag identity is declared more than once.');
      if (classes.has(classIdentity)) problem('duplicate-class', `${dp}.name`, 'Module/class identity is declared more than once.');
      tags.add(tagName); classes.add(classIdentity);
      declarations.push({ modulePath, className, tagName, ...(description !== undefined ? { description } : {}), attributes, properties, ...surfaces });
    });
  });
  return { declarations, problems };
}

/** "'sm' | 'md' | 'lg'" → ['sm','md','lg'] (CEM types are plain text). */
function parseUnion(text: string): string[] | null {
  const parts = text.split('|').map((p) => p.trim());
  const values: string[] = [];
  for (const p of parts) {
    const m = p.match(/^['"]([^'"]*)['"]$/);
    if (m) values.push(m[1]);
    else if (p === 'undefined') continue;
    else return null;
  }
  return values.length > 0 ? values : null;
}

function stripQuotes(s: string | undefined): string | number | boolean | undefined {
  if (s === undefined) return undefined;
  const m = s.match(/^['"](.*)['"]$/);
  if (m) return m[1];
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function classify(typeText: string | undefined): Pick<ExtractedProp, 'kind' | 'values'> {
  if (!typeText) return { kind: 'other' };
  const union = parseUnion(typeText);
  if (union) return { kind: 'enum', values: union };
  if (typeText === 'boolean') return { kind: 'boolean' };
  if (typeText === 'string') return { kind: 'string' };
  if (typeText === 'number') return { kind: 'number' };
  return { kind: 'other' };
}

/** "sl-remove" → "onRemove"-style camel event prop name for reconciliation. */
const eventPropName = (eventName: string): string =>
  'on' +
  eventName
    .replace(/^[a-z0-9]+-/, '') // vendor prefix (sl-remove → remove)
    .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase());

export function extractCem(manifestPath: string, skipped?: SkippedComponent[]): ExtractedComponent[] {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { modules?: CemModule[] };
  const out: ExtractedComponent[] = [];
  for (const mod of manifest.modules ?? []) {
    for (const decl of mod.declarations ?? []) {
      if (!decl.customElement && decl.kind !== 'class') {
        // A mixin that carries a component-shaped surface (attributes/events)
        // is visible-but-not-a-component: its surface reaches the manifest
        // through the classes that apply it. NAMED skip, not silence — plain
        // functions/variables carry no component surface and stay out.
        if (decl.kind === 'mixin' && decl.name && ((decl.attributes?.length ?? 0) > 0 || (decl.events?.length ?? 0) > 0)) {
          skipped?.push({
            name: decl.name,
            source: `${manifestPath}${mod.path ? ` (${mod.path})` : ''}`,
            reason: `CEM "mixin" declaration with ${decl.attributes?.length ?? 0} attribute(s) / ${decl.events?.length ?? 0} event(s) — not a custom element; its surface is carried by the classes that apply it, not extracted as a component`,
          });
        }
        continue;
      }
      const name = decl.name ?? decl.tagName;
      if (!name) continue;
      const props: ExtractedProp[] = [];
      const seen = new Set<string>();
      // attributes carry the public API; fall back to public fields
      const sources = [
        ...(decl.attributes ?? []),
        ...(decl.members ?? []).filter((m) => m.kind === 'field' && m.privacy !== 'private' && m.privacy !== 'protected'),
      ];
      for (const a of sources) {
        if (seen.has(a.name)) continue;
        seen.add(a.name);
        const def = stripQuotes(a.default);
        props.push({
          name: a.name,
          optional: true, // CEM does not model requiredness
          ...classify(a.type?.text),
          ...(def !== undefined && def !== '' ? { default: def } : {}),
          ...(a.description ? { description: a.description } : {}),
          confidence: 'declared',
        });
      }
      for (const [i, e] of (decl.events ?? []).entries()) {
        if (!e.name) {
          // A manifest event with no name cannot map to an event prop —
          // reported BY NAME (component + index + whatever the manifest does
          // say), never a crash, never silently dropped.
          skipped?.push({
            name: `${name} event[${i}]`,
            source: `${manifestPath}${mod.path ? ` (${mod.path})` : ''}`,
            reason: `CEM event has no "name"${e.type?.text ? ` (type: ${e.type.text})` : ''}${e.description ? ` (description: ${e.description})` : ''} — cannot derive an event prop; skipped`,
          });
          continue;
        }
        props.push({
          name: eventPropName(e.name),
          kind: 'event',
          optional: true,
          ...(e.description ? { description: `${e.description} (CEM event "${e.name}")` } : { description: `CEM event "${e.name}"` }),
          confidence: 'inferred', // prop-name spelling is our mapping, not the manifest's
        });
      }
      out.push({
        name,
        source: `${manifestPath}${mod.path ? ` (${mod.path})` : ''}`,
        adapter: 'cem',
        ...(decl.description ? { description: decl.description } : {}),
        props,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
