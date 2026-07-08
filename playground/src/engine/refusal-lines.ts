/**
 * Refusal → editor line resolution. Dependency-free, text-walking only.
 *
 * Two resolvers, one honesty rule: when a refusal cannot be pinned to a line
 * with certainty, the answer is null and NO line is highlighted — never a
 * guess.
 *
 * - Zod path issues (`props.1.type: …`): a small JSON scanner walks the
 *   editor text tracking the key/index path and returns the line where the
 *   addressed value starts. The scanner tolerates the malformed tail of a
 *   mid-edit document by bailing to null.
 * - Generator messages (`… references token "{radius.bogus}" which does not
 *   exist …`): the quoted offending string is extracted from the message and
 *   the first line of the text containing it wins. Brace-wrapped token refs
 *   are preferred (they appear verbatim in the contract); other quoted
 *   values are searched WITH their quotes so `"root"` matches the JSON key,
 *   not every substring.
 * - JSON parse errors: modern engines name `(line N column M)` in the
 *   message — that line is taken at its word.
 */

export interface RefusalIssue {
  /** The refusal text, verbatim. */
  text: string;
  /** Structured path when the referee provided one (zod issues). */
  path?: (string | number)[];
}

const lineOf = (text: string, offset: number): number => {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
};

/** Line (0-based) where the value at `path` starts, or null when the path
 *  cannot be walked in this text. */
export function locateJsonPath(text: string, path: (string | number)[]): number | null {
  let i = 0;
  const n = text.length;

  const ws = () => {
    while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i += 1;
  };

  /** Parse the string starting at text[i] === '"'. Returns its value, or
   *  null on an unterminated string. Leaves i past the closing quote. */
  const parseString = (): string | null => {
    i += 1; // opening quote
    let out = '';
    while (i < n) {
      const c = text[i];
      if (c === '\\') {
        const esc = text[i + 1];
        if (esc === 'u') {
          out += '�';
          i += 6;
        } else {
          out += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : (esc ?? '');
          i += 2;
        }
      } else if (c === '"') {
        i += 1;
        return out;
      } else {
        out += c;
        i += 1;
      }
    }
    return null;
  };

  /** Consume one JSON value without path tracking. */
  const skipValue = (): boolean => {
    ws();
    const c = text[i];
    if (c === '"') return parseString() !== null;
    if (c === '{' || c === '[') {
      const open = c;
      const close = c === '{' ? '}' : ']';
      let depth = 0;
      while (i < n) {
        const ch = text[i];
        if (ch === '"') {
          if (parseString() === null) return false;
          continue;
        }
        if (ch === open) depth += 1;
        else if (ch === close) {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            return true;
          }
        }
        i += 1;
      }
      return false;
    }
    // number / true / false / null — consume to the next delimiter
    const start = i;
    while (i < n && !',]}'.includes(text[i]) && !/\s/.test(text[i])) i += 1;
    return i > start;
  };

  const locate = (remaining: (string | number)[]): number | null => {
    ws();
    if (remaining.length === 0) return i < n ? lineOf(text, i) : null;
    const c = text[i];
    if (c === '{') {
      if (typeof remaining[0] !== 'string') return null;
      i += 1;
      for (;;) {
        ws();
        if (i >= n || text[i] === '}') return null; // key absent (e.g. "missing required")
        if (text[i] !== '"') return null;
        const key = parseString();
        if (key === null) return null;
        ws();
        if (text[i] !== ':') return null;
        i += 1;
        if (key === remaining[0]) return locate(remaining.slice(1));
        if (!skipValue()) return null;
        ws();
        if (text[i] === ',') {
          i += 1;
          continue;
        }
        return null;
      }
    }
    if (c === '[') {
      if (typeof remaining[0] !== 'number') return null;
      i += 1;
      let index = 0;
      for (;;) {
        ws();
        if (i >= n || text[i] === ']') return null;
        if (index === remaining[0]) return locate(remaining.slice(1));
        if (!skipValue()) return null;
        ws();
        if (text[i] === ',') {
          i += 1;
          index += 1;
          continue;
        }
        return null;
      }
    }
    return null; // the path addresses into a scalar — nothing to point at
  };

  try {
    return locate(path);
  } catch {
    return null;
  }
}

/** First line of `text` containing the offending value a generator message
 *  quotes, or null when nothing quotable resolves. */
export function locateMentioned(text: string, message: string): number | null {
  const lines = text.split('\n');
  const firstLineWith = (needle: string): number | null => {
    const idx = lines.findIndex((l) => l.includes(needle));
    return idx === -1 ? null : idx;
  };

  const quoted = [...message.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  // Brace-wrapped token refs first — they appear verbatim in the contract
  // text and are the most specific anchor a message carries.
  const braceRefs = quoted.filter((q) => q.startsWith('{') && q.endsWith('}'));
  for (const ref of braceRefs) {
    const hit = firstLineWith(ref);
    if (hit !== null) return hit;
  }
  // Other quoted values are searched WITH their quotes, so short words only
  // match where they stand as JSON strings/keys.
  for (const value of quoted) {
    if (value.startsWith('{') && value.endsWith('}')) continue;
    const hit = firstLineWith(`"${value}"`);
    if (hit !== null) return hit;
  }
  return null;
}

/** Line named by a JSON.parse error message (`… (line N column M)`), 0-based. */
export function locateJsonParseError(message: string): number | null {
  const m = message.match(/\(line (\d+) column \d+\)/);
  return m ? Math.max(0, Number(m[1]) - 1) : null;
}

/** Resolve every issue to a line (or null), parallel to the input. */
export function resolveIssueLines(text: string, issues: RefusalIssue[]): (number | null)[] {
  return issues.map((issue) =>
    issue.path ? locateJsonPath(text, issue.path) : locateMentioned(text, issue.text),
  );
}
