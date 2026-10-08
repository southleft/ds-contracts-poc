/** CSS lengths cannot use exponent notation in the contract scalar grammar.
 * Expand the number's round-trippable spelling without rounding its value. */
export const cssDecimal = (value: number): string => {
  const raw = String(value);
  if (!/[eE]/.test(raw)) return raw;
  const [mantissa, exponent] = raw.toLowerCase().split('e');
  const sign = mantissa.startsWith('-') ? '-' : '';
  const unsigned = sign ? mantissa.slice(1) : mantissa;
  const digits = unsigned.replace('.', '');
  const at = (unsigned.includes('.') ? unsigned.indexOf('.') : unsigned.length) + Number(exponent);
  return sign + (at <= 0 ? `0.${'0'.repeat(-at)}${digits}`
    : at >= digits.length ? digits + '0'.repeat(at - digits.length)
      : `${digits.slice(0, at)}.${digits.slice(at)}`);
};

