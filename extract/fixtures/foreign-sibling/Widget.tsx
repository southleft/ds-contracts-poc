/**
 * FIXTURE (Fluent-2-shaped, synthesized): the component file holds NO type
 * declarations — `WidgetProps` lives in the sibling `Widget.types.ts` — and
 * the export is an `as`-cast of a forwardRef call. Before the sibling-type-
 * file + cast-transparency rules this was invisible: neither extracted nor
 * skipped.
 */
import * as React from 'react';
import type { ForwardRefComponent } from './fake-utilities';
import type { WidgetProps } from './Widget.types';

export const Widget: ForwardRefComponent<WidgetProps> = React.forwardRef((props, ref) => {
  return <button ref={ref} {...(props as object)} />;
}) as ForwardRefComponent<WidgetProps>;

Widget.displayName = 'Widget';
