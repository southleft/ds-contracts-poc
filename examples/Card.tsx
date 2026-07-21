import { createElement } from 'react';
export function Card(props: any) { return createElement('article', { 'data-card': props.title }, props.title, props.children); }
