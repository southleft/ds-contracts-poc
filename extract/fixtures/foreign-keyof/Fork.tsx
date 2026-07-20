/**
 * Eval fixture — UNION-OF-REFS with a DARK branch: one branch is readable
 * in module scope, the other is imported. The readable branch's members are
 * carried; the imported branch is receipted BY NAME as a composed reference
 * whose members are NOT carried — never silently dropped, never guessed.
 */
import * as React from 'react';
import type {ImportedForkProps} from 'fork-pack';

export interface LocalForkProps {
  /** Which prong. */
  prong?: 'left' | 'right';
  /** Sharpness flag. */
  sharp?: boolean;
}

export type ForkProps = LocalForkProps | ImportedForkProps;

export function Fork(props: ForkProps) {
  return <div data-sharp={(props as LocalForkProps).sharp} />;
}
