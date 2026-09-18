import type { BrowserContext, Page } from 'playwright-core';
import { createHash } from 'node:crypto';
import { readLitTemplateBindings, type LitTemplateInput } from '../extract/adapters/lit-template.js';

export interface LitRenderObservationPolicy {
  version: 1;
  sourceSha256: string;
  className: string;
  tagName: string;
}
export type LitObservedValue =
  | { kind: 'scalar'; value: string | number | boolean | null }
  | { kind: 'undefined' | 'function' | 'symbol' | 'opaque' }
  | { kind: 'array'; values: LitObservedValue[] }
  | { kind: 'template'; strings: string[]; values: LitObservedValue[] };
export interface LitRenderObservation {
  version: 1;
  policy: LitRenderObservationPolicy;
  status: 'captured' | 'refused';
  problems: string[];
  renders: number;
  last?: {
    value: LitObservedValue;
    staticFields: Array<{ property: string; value: string }>;
  };
}

/** Opt in only for the exact source's supported static HTML import. The caller
 * still verifies source/package identities; lexical imports are not signatures. */
export function deriveLitRenderObservationPolicy(
  source: LitTemplateInput,
  declaration: { className: string; tagName: string },
): LitRenderObservationPolicy | undefined {
  const read = readLitTemplateBindings(source);
  if (read.status === 'refused' || declaration.className !== source.className ||
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(declaration.tagName) ||
      !read.templates.some(t => ['lit/static-html.js', 'lit-html/static.js'].includes(t.import.module))) return;
  return { version: 1, sourceSha256: source.sourceSha256, className: source.className, tagName: declaration.tagName };
}

const probeKey = '__dsContractsLitRenderObservationV1';

/** Observe the actual render return without calling render again, evaluating
 * getters, changing arguments/results, or rewriting source/template strings.
 * This is explicitly instrumented evidence, not admission or behavior proof. */
export async function installLitRenderObservationProbe(context: BrowserContext, policy: LitRenderObservationPolicy) {
  const install = ({ policy, key }: { policy: LitRenderObservationPolicy; key: string }) => {
    const records = new WeakMap<Element, LitRenderObservation>();
    const descriptor = Object.getOwnPropertyDescriptor;
    const descriptors = Object.getOwnPropertyDescriptors;
    const clone = structuredClone.bind(window);
    const apply = Reflect.apply;
    const isArray = Array.isArray;
    const brand = Symbol.for('');
    const problems: string[] = [];
    const fail = (code: string): never => { throw Error(code); };
    const own = (object: object, key: PropertyKey) => {
      const d = descriptor(object, key);
      if (d && !('value' in d)) fail('render-observation-accessor-refused');
      return d?.value;
    };
    let watchedPrototype: object | undefined, wrapped: Function | undefined;
    if (Object.hasOwn(window, key)) throw Error('render-observation-probe-key-collision');
    Object.defineProperty(window, key, { configurable: false, writable: false, value: (element: Element) => {
      const record = records.get(element);
      const issues = [...problems, ...(record?.problems ?? [])];
      if (!record) issues.push('render-observation-missing');
      if (!watchedPrototype || descriptor(watchedPrototype, 'render')?.value !== wrapped || descriptor(element, 'render')) issues.push('render-observation-wrapper-changed');
      return clone({ version: 1, policy, ...(record ?? { renders: 0 }), problems: issues,
        status: issues.length ? 'refused' : 'captured' });
    } });
    const define = customElements.define;
    customElements.define = function(name, constructor, options) {
      if (name === policy.tagName) {
        const original = descriptor(constructor.prototype, 'render');
        if (!original || typeof original.value !== 'function' || !original.configurable || watchedPrototype) problems.push('render-observation-method-unavailable');
        else {
          watchedPrototype = constructor.prototype;
          wrapped = function(this: Element, ...args: unknown[]) {
            const previous = records.get(this);
            const record: LitRenderObservation = { version: 1, policy, status: 'refused', renders: (previous?.renders ?? 0) + 1, problems: [...(previous?.problems ?? [])] };
            let returned: unknown;
            try { returned = apply(original.value, this, args); }
            catch(error) { record.problems.push('render-observation-original-threw'); records.set(this, record); throw error; }
            try {
              if (record.renders > 32) fail('render-observation-call-limit');
              let budget = 2048, bytes = 0;
              const seen = new Set<object>();
              const text = (s: string) => { bytes += s.length; if(bytes > 262144) fail('render-observation-byte-limit'); return s; };
              const snapshot = (value: unknown, depth = 0): LitObservedValue => {
                if (--budget < 0 || depth > 32) fail('render-observation-value-limit');
                if (value === undefined) return { kind: 'undefined' };
                if (value === null || typeof value === 'boolean' || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)))
                  return { kind: 'scalar', value: typeof value === 'string' ? text(value) : value };
                if (typeof value === 'function' || typeof value === 'symbol') return { kind: typeof value } as LitObservedValue;
                if (typeof value !== 'object') return { kind: 'opaque' };
                if (seen.has(value)) fail('render-observation-cycle');
                seen.add(value);
                try {
                  const array = (items: unknown, strings = false): any[] => {
                    if (!isArray(items)) fail('render-observation-array-invalid');
                    const length = own(items as object, 'length');
                    if (!Number.isInteger(length) || length > 2048) fail('render-observation-array-limit');
                    return Array.from({length}, (_, i) => {
                      if (!descriptor(items as object, String(i))) fail('render-observation-sparse-array');
                      const item = own(items as object, String(i));
                      if (strings) { if (typeof item !== 'string') fail('render-observation-template-string-invalid'); return text(item); }
                      return snapshot(item, depth + 1);
                    });
                  };
                  if (isArray(value)) return {kind:'array',values:array(value)};
                  const type = own(value, '_$litType$');
                  if (type === undefined) return { kind: 'opaque' };
                  if (type !== 1) fail('render-observation-template-kind-unsupported');
                  const strings = array(own(value,'strings'), true), values = array(own(value,'values'));
                  if (strings.length !== values.length + 1) fail('render-observation-template-arity');
                  return {kind:'template',strings,values};
                } finally { seen.delete(value); }
              };
              const fields = descriptors(this), keys = Object.keys(fields);
              if (keys.length > 2048) fail('render-observation-field-limit');
              const staticFields: Array<{property:string;value:string}> = [];
              for (const property of keys) {
                const field = fields[property];
                if (!('value' in field) || !field.value || typeof field.value !== 'object') continue;
                // Lit's explicit StaticValue brand, not a property name or TS annotation.
                const r = descriptor(field.value, 'r');
                if (!r || !('value' in r) || r.value !== brand) continue;
                const value = own(field.value, '_$litStatic$');
                if (typeof value !== 'string') fail('render-observation-static-value-invalid');
                staticFields.push({property,value:text(value)});
              }
              record.last = { value: snapshot(returned), staticFields };
              if (record.last.value.kind !== 'template') fail('render-observation-root-not-template');
              record.status = record.problems.length ? 'refused' : 'captured';
            } catch (error) { record.problems.push(error instanceof Error ? error.message : 'render-observation-unreadable'); }
            records.set(this, record);
            return returned;
          };
          Object.defineProperty(constructor.prototype, 'render', { ...original, value: wrapped });
        }
      }
      return apply(define, this, [name, constructor, options]);
    };
  };
  await context.addInitScript({ content: `(()=>{const __name=value=>value;(${install.toString()})(${JSON.stringify({policy,key:probeKey})})})()` });
}

export async function observeLitRender(page: Page, hostPath: string[]): Promise<LitRenderObservation | undefined> {
  return page.evaluate(({key,selectors}) => {
    const read = (window as any)[key];
    if (typeof read !== 'function') return;
    let scope: Document | ShadowRoot | null = document, host: Element | undefined;
    for (const selector of selectors) {
      const nodes: NodeListOf<Element> | undefined = scope?.querySelectorAll(selector);
      if(nodes?.length !== 1) throw Error('render-observation-host-not-unique');
      host = nodes[0]; scope = host.shadowRoot;
    }
    if(!host) throw Error('render-observation-host-missing');
    return read(host);
  }, {key:probeKey,selectors:hostPath});
}

/** Bracket the retained render snapshot with the same source image. Changes in
 * render count, values or static fields refuse even if their pixels are equal. */
export async function captureStableLitRender(page: Page, hostPath: string[], sourcePngSha256: string): Promise<LitRenderObservation | undefined> {
  const pngHash = async () => createHash('sha256').update(await page.screenshot({fullPage:true,caret:'initial'})).digest('hex');
  const beforePng = await pngHash();
  const before = await observeLitRender(page,hostPath);
  if (!before) return;
  const after = await observeLitRender(page,hostPath);
  const afterPng = await pngHash();
  if (beforePng !== sourcePngSha256 || afterPng !== sourcePngSha256 || JSON.stringify(before) !== JSON.stringify(after))
    return {...before,status:'refused',problems:[...before.problems,'render-observation-not-stable']};
  return before;
}
