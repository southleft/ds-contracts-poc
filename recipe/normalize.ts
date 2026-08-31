/**
 * Canonical JSON for the experimental recipe path.
 *
 * This module deliberately canonicalizes representation, not semantics:
 * object keys are ordered, but arrays and scalar values keep their meaning.
 * Values JSON would silently omit or coerce are refused instead.
 */

export type CanonicalJsonScalar = null | boolean | number | string;
export type CanonicalJsonValue =
  | CanonicalJsonScalar
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export class CanonicalizationError extends TypeError {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "CanonicalizationError";
  }
}

/** ECMAScript compares strings by UTF-16 code units; unlike localeCompare, this is locale-free. */
const compareKeys = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const childPath = (path: string, key: string): string =>
  `${path}[${encodeString(key)}]`;

const valueKind = (prototype: object): string => {
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
  const name =
    constructor &&
    "value" in constructor &&
    typeof constructor.value === "function"
      ? constructor.value.name
      : undefined;
  return name ? `non-plain object ${name}` : "non-plain object";
};

function normalizeValue(
  value: unknown,
  path: string,
  ancestors: Set<object>,
): CanonicalJsonValue {
  if (value === null) return null;

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      if (!Number.isFinite(value)) {
        throw new CanonicalizationError(
          "non-finite numbers are not canonical JSON",
          path,
        );
      }
      // JSON has one zero. Pin that policy instead of relying on a serializer
      // to happen to collapse -0.
      return Object.is(value, -0) ? 0 : value;
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new CanonicalizationError(
        `${typeof value} is not canonical JSON`,
        path,
      );
    case "object":
      break;
  }

  if (ancestors.has(value)) {
    throw new CanonicalizationError("cycle detected", path);
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value);
      for (const key of ownKeys) {
        if (
          key === "length" ||
          (typeof key === "string" &&
            /^(?:0|[1-9]\d*)$/.test(key) &&
            Number(key) < value.length)
        ) {
          continue;
        }
        throw new CanonicalizationError(
          `array has unsupported own property ${String(key)}`,
          path,
        );
      }

      const normalized: CanonicalJsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new CanonicalizationError(
            "sparse arrays are not canonical JSON",
            `${path}[${index}]`,
          );
        }
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          String(index),
        );
        if (!descriptor?.enumerable || !("value" in descriptor)) {
          throw new CanonicalizationError(
            "non-enumerable array elements and accessors are not canonical JSON",
            `${path}[${index}]`,
          );
        }
        normalized.push(
          normalizeValue(descriptor.value, `${path}[${index}]`, ancestors),
        );
      }
      return normalized;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CanonicalizationError(valueKind(prototype), path);
    }

    const keys = Reflect.ownKeys(value);
    for (const key of keys) {
      if (typeof key === "symbol") {
        throw new CanonicalizationError(
          "symbol-keyed properties are not canonical JSON",
          path,
        );
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new CanonicalizationError(
          "non-enumerable properties and accessors are not canonical JSON",
          childPath(path, key),
        );
      }
    }

    const normalized: { [key: string]: CanonicalJsonValue } = {};
    for (const key of (keys as string[]).sort(compareKeys)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      Object.defineProperty(normalized, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: normalizeValue(
          (descriptor as PropertyDescriptor & { value: unknown }).value,
          childPath(path, key),
          ancestors,
        ),
      });
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Return a detached canonical JSON value. Shared non-cyclic references are
 * serialized by value; only active ancestor cycles are rejected.
 */
export function normalizeCanonicalJson(value: unknown): CanonicalJsonValue {
  return normalizeValue(value, "$", new Set());
}

const hex4 = (codeUnit: number): string =>
  codeUnit.toString(16).padStart(4, "0");

/**
 * Encode a JSON string without delegating escaping to a host serializer.
 * Valid surrogate pairs remain literal Unicode; lone surrogates are escaped.
 */
function encodeString(value: string): string {
  let encoded = '"';
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    switch (codeUnit) {
      case 0x08:
        encoded += "\\b";
        continue;
      case 0x09:
        encoded += "\\t";
        continue;
      case 0x0a:
        encoded += "\\n";
        continue;
      case 0x0c:
        encoded += "\\f";
        continue;
      case 0x0d:
        encoded += "\\r";
        continue;
      case 0x22:
        encoded += '\\"';
        continue;
      case 0x5c:
        encoded += "\\\\";
        continue;
    }

    if (codeUnit <= 0x1f) {
      encoded += `\\u${hex4(codeUnit)}`;
      continue;
    }
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        encoded += value[index] + value[index + 1];
        index += 1;
      } else {
        encoded += `\\u${hex4(codeUnit)}`;
      }
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      encoded += `\\u${hex4(codeUnit)}`;
      continue;
    }
    encoded += value[index];
  }
  return `${encoded}"`;
}

function serializeCanonical(value: CanonicalJsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return encodeString(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonical).join(",")}]`;
  }

  const entries = Object.keys(value)
    .sort(compareKeys)
    .map((key) => `${encodeString(key)}:${serializeCanonical(value[key]!)}`);
  return `{${entries.join(",")}}`;
}

/** Canonical, whitespace-free JSON with recursively sorted object keys. */
export function canonicalJson(value: unknown): string {
  return serializeCanonical(normalizeCanonicalJson(value));
}

/** The exact UTF-8 bytes consumed by recipe hashing. */
export function canonicalJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}
