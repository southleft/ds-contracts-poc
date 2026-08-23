/**
 * Naming helpers shared by every emitter.
 *
 * `kebab` is the ONE spelling of "ComponentName" → "component-name" the
 * engine uses for file names (html/figma-script emitters), custom-element
 * tags, CSS custom-property stems and the canvas→code file plan. Emitters
 * outside this repo must produce the same spelling or their files will not
 * line up with the CLI's — so it is published, not reimplemented.
 */
export const kebab = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
