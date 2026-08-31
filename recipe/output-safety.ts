import path from "node:path";

const CSS_INJECTION = /[;{}]|\/\*|\*\/|url\s*\(|var\s*\(/i;
const FAMILY = /^(?:[A-Za-z][A-Za-z0-9 -]*|"(?:[^"\\\r\n]|\\["\\])*")$/;
const TOKEN = /^[A-Za-z][A-Za-z0-9._-]*$/;
const hasControl = (value: string): boolean =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint < 32 || codePoint === 127;
  });

export const cssString = (value: string): string => {
  if (hasControl(value)) {
    throw new TypeError(
      "input-field output: CSS string contains control characters",
    );
  }
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
};

export const parseFontFamilyStack = (input: string): string[] => {
  if (
    input.trim() !== input ||
    input.length === 0 ||
    CSS_INJECTION.test(input)
  ) {
    throw new TypeError(
      `input-field output: unsafe font-family ${JSON.stringify(input)}`,
    );
  }
  const families: string[] = [];
  let current = "";
  let quoted = false;
  let escaped = false;
  for (const character of input) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      current += character;
      escaped = true;
    } else if (character === '"') {
      current += character;
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      families.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (quoted || escaped) {
    throw new TypeError("input-field output: unterminated font-family quote");
  }
  families.push(current.trim());
  if (
    families.some(
      (family) =>
        family.length === 0 ||
        !FAMILY.test(family) ||
        hasControl(family) ||
        CSS_INJECTION.test(family),
    )
  ) {
    throw new TypeError(
      `input-field output: invalid font-family stack ${JSON.stringify(input)}`,
    );
  }
  return families.map((family) =>
    family.startsWith('"') ? JSON.parse(family) : family,
  );
};

export const quoteFontFamilyStack = (families: readonly string[]): string => {
  if (families.length === 0) {
    throw new TypeError("input-field output: font-family stack is empty");
  }
  return families.map(cssString).join(", ");
};

export const cssTokenName = (identity: string): string => {
  if (!TOKEN.test(identity) || hasControl(identity)) {
    throw new TypeError(
      `input-field output: invalid token identity ${JSON.stringify(identity)}`,
    );
  }
  return `--${identity.replaceAll(".", "-").toLowerCase()}`;
};

export const buildCssTokenNameMap = (
  identities: readonly string[],
): Map<string, string> => {
  const byCssName = new Map<string, string>();
  const result = new Map<string, string>();
  for (const identity of [...new Set(identities)].sort()) {
    const cssName = cssTokenName(identity);
    const previous = byCssName.get(cssName);
    if (previous !== undefined && previous !== identity) {
      throw new TypeError(
        `input-field output: token-name collision ${previous} and ${identity} both sanitize to ${cssName}`,
      );
    }
    byCssName.set(cssName, identity);
    result.set(identity, cssName);
  }
  return result;
};

export const assertSafeOutputFiles = <File extends { path: string }>(
  files: readonly File[],
  root: string,
): void => {
  const normalizedRoot = path.posix.normalize(root).replace(/\/+$/, "");
  for (const file of files) {
    if (
      file.path.includes("\\") ||
      path.posix.isAbsolute(file.path) ||
      path.posix.normalize(file.path) !== file.path ||
      !file.path.startsWith(`${normalizedRoot}/`) ||
      file.path === normalizedRoot
    ) {
      throw new TypeError(
        `input-field output: generated path escapes ${normalizedRoot}: ${JSON.stringify(file.path)}`,
      );
    }
  }
};

export const assertCssLiteral = (value: string, label: string): string => {
  if (
    value.trim() !== value ||
    value.length === 0 ||
    hasControl(value) ||
    CSS_INJECTION.test(value) ||
    /["'\\]/.test(value)
  ) {
    throw new TypeError(
      `input-field output: unsafe ${label} ${JSON.stringify(value)}`,
    );
  }
  return value;
};
