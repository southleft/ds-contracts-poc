import React from 'react';
import type { NativeContractUpdatePlan } from '../../../core/native-contract-update';

/** Review values use the shortest round-trippable number spelling. Rounding
 * here can make a real proposed change appear to have identical endpoints. */
export function designValue(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return String(value);
  const text = JSON.stringify(value);
  return text.length <= 120 ? text : <details>
    <summary>{text.slice(0, 117)}…</summary>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{text}</pre>
  </details>;
}

export function correctionValue(value: NativeContractUpdatePlan['changes'][number]['before'] | NativeContractUpdatePlan['changes'][number]['after']) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value.length) return 'No shadows';
  return <ol>{value.map((effect,index)=><li key={index}>
    {effect.type==='INNER_SHADOW'?'Inner':'Outer'} shadow: offset {effect.offset.x}, {effect.offset.y} px;
    blur {effect.radius} px; spread {effect.spread} px;
    RGBA (0–1): {[effect.color.r,effect.color.g,effect.color.b,effect.color.a].map(String).join(', ')}
  </li>)}</ol>;
}
