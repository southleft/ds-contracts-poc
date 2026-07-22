import { createElement } from 'react';
export function Button(props: any) { return createElement('button', { 'data-button': props.variant }, props.children); }
