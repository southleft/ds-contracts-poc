import { createElement } from 'react';
export function Badge(props: any) { return createElement('span', { 'data-badge': true }, props.children); }
