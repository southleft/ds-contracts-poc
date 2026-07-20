/**
 * @ds-contracts/emitter-web-components — the emitter plugin, Emitter-shaped.
 *
 * Loadable both ways the registry supports:
 *   · CLI:    ds-contracts generate <contracts..> --out <dir>
 *               --target web-components
 *               --emitter @ds-contracts/emitter-web-components
 *             (the CLI registerEmitter()s the default export before emitting)
 *   · direct: import wc from '@ds-contracts/emitter-web-components';
 *             registerEmitter(wc);
 *
 * The emit function is pure (contract + ctx in, file texts out) — the same
 * discipline as the four built-ins in core/emitter.ts.
 */
import type { Contract } from '../../schema/src/contract-schema.js';
import type { EmittedFile, Emitter, EmitterCtx } from '../../../core/emitter.js';
import { emitWebComponent, tagOf, type EmitWcResult, type WcEmitCtx } from './emit-wc.js';

export {
  attrOf,
  classNameOf,
  emitWebComponent,
  propFromAttr,
  shadowCss,
  tagOf,
  type EmitWcResult,
  type WcEmitCtx,
} from './emit-wc.js';

export const webComponentsEmitter: Emitter = {
  name: 'web-components',
  label: 'Vanilla Custom Elements (shadow DOM + constructable stylesheet, zero runtime deps)',
  emit(contract: Contract, ctx: EmitterCtx): EmittedFile[] {
    const tag = tagOf(contract);
    const result: EmitWcResult = emitWebComponent(contract, {
      icons: ctx.icons,
      contracts: ctx.contracts,
    });
    return [
      { path: `${tag}.ts`, contents: result.element },
      { path: `${tag}.css.ts`, contents: result.stylesheet },
      { path: `${tag}.demo.html`, contents: result.demo },
      { path: `${tag}.custom-elements.json`, contents: result.manifest },
    ];
  },
};

export default webComponentsEmitter;
