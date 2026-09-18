/** CSS identifier serialization. Preserve simple class bytes; escape selector
 * punctuation and leading digits without changing the public anatomy key. */
export function cssIdentifier(value: string): string {
  let out = "";
  for (const [index, char] of [...value].entries()) {
    const code = char.codePointAt(0)!;
    if (code === 0) {
      out += "\uFFFD";
      continue;
    }
    if (
      code < 32 ||
      code === 127 ||
      (/[0-9]/.test(char) && (index === 0 || (index === 1 && value[0] === "-")))
    ) {
      out += "\\" + code.toString(16) + " ";
      continue;
    }
    if (value === "-") {
      out += "\\-";
      continue;
    }
    out += code >= 128 || /[A-Za-z0-9_-]/.test(char) ? char : "\\" + char;
  }
  return out;
}
