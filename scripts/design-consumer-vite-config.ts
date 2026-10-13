/** Standalone consumer config: preserve the postcss-modules 6.0.1 default
 * names shipped in Vite 7.3.7 without rescanning a large sheet for every
 * repeated class occurrence. Only the latest CSS content per file is kept.
 * This is emitted JavaScript, not a closure over this repository. */
export const CONSUMER_VITE_CONFIG = String.raw`const files = new Map();
function generateScopedName(name, filename, css) {
  let file = files.get(filename);
  if (!file || file.css !== css) {
    let hash = 5381;
    for (let i = css.length; i;) hash = hash * 33 ^ css.charCodeAt(--i);
    file = { css, hash: (hash >>> 0).toString(36).substr(0, 5), names: new Map() };
    files.set(filename, file);
  }
  if (file.names.has(name)) return file.names.get(name);
  const index = css.indexOf('.' + name);
  const line = css.substr(0, index).split(/[\r\n]/).length;
  const scoped = '_' + name + '_' + file.hash + '_' + line;
  file.names.set(name, scoped);
  return scoped;
}
export default {
  base: './',
  esbuild: { jsx: 'automatic' },
  build: { minify: false },
  css: { modules: { generateScopedName } },
};
`;
