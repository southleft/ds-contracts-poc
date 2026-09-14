// Checker-side arithmetic. The report generator independently derives its
// cohort from its own library registry and disk inventory.
export function coverageCohort(rows) {
  const seen = new Set();
  const known = [];
  const unknown = [];
  for (const row of rows) {
    if (!row.key || seen.has(row.key)) throw new Error('coverage: missing or duplicate library');
    seen.add(row.key);
    for (const field of ['contracts', 'pinned']) {
      if (!Number.isSafeInteger(row[field]) || row[field] < 0) throw new Error(`coverage: invalid ${field} for ${row.key}`);
    }
    if (row.pinned > row.contracts) throw new Error(`coverage: pinned exceeds committed for ${row.key}`);
    if (row.size === null) unknown.push(row);
    else {
      if (!Number.isSafeInteger(row.size) || row.size <= 0 || row.contracts > row.size) {
        throw new Error(`coverage: invalid size for ${row.key}`);
      }
      known.push(row);
    }
  }
  const sum = (xs, key) => xs.reduce((n, row) => n + row[key], 0);
  const size = sum(known, 'size');
  const pinned = sum(known, 'pinned');
  return {
    libraries: known.length, unknownLibraries: unknown.length,
    contracts: sum(known, 'contracts'), pinned, size,
    unknownContracts: sum(unknown, 'contracts'), unknownPinned: sum(unknown, 'pinned'),
    allContracts: sum(rows, 'contracts'), allPinned: sum(rows, 'pinned'),
    pct: size ? 100 * pinned / size : null,
  };
}

export function captureProseFailures(text, expected) {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];
  const number = (s) => /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : words.indexOf(s.toLowerCase());
  const plain = text.replace(/\*\*/g, '').replace(/\s+/g, ' ');
  const claims = [
    ['measured components and libraries', /(\d+) components across (\d+|[a-z]+) libraries/gi, [expected.measured, expected.libraries]],
    ['measured library count', /(\d+|[a-z]+) third-party component libraries —/gi, [expected.libraries]],
    ['measured component list', /Every one of the (\d+) is listed/gi, [expected.measured]],
    ['known-size library count', /the (\d+|[a-z]+) libraries with a measured size/gi, [expected.knownLibraries]],
    ['measured library count', /the "(\d+|[a-z]+) libraries" the fidelity numbers/gi, [expected.libraries]],
    ['golden file count', /(\d+) generated files hashed against a golden manifest/gi, [expected.goldenFiles]],
    ['nonempty comparison count', /mean uses (\d+) nonempty comparisons; (\d+) zero-cell scorecard/gi, [expected.nonempty, expected.empty]],
  ];
  const failures = [];
  for (const [label, pattern, values] of claims) {
    for (const match of plain.matchAll(pattern)) {
      const actual = match.slice(1).map(number);
      if (actual.some((value, i) => value !== values[i])) failures.push(`${label}: ${actual.join('/')} stated, ${values.join('/')} measured`);
    }
  }
  return failures;
}

export function coverageTableFailures(text, cohort) {
  const rows = text.split('\n');
  const cells = (name) => rows.find((line) => line.startsWith(`| **${name}** |`))?.split('|').slice(1, -1).map((s) => s.replace(/\*/g, '').trim());
  const number = (s) => /^\d[\d,]*$/.test(s ?? '') ? Number(s.replace(/,/g, '')) : null;
  const total = cells('total');
  const known = cells('known-size cohort');
  const failures = [];
  if (!total || number(total[1]) !== cohort.allContracts || number(total[2]) !== cohort.allPinned) failures.push('all-library inventory disagrees');
  if (cohort.unknownLibraries > 0 && (!total || !/unknown|unmeasured/i.test(total[3]) || total[4] !== '—')) failures.push('unknown-size libraries prohibit an all-library coverage percentage');
  if (!known || number(known[1]) !== cohort.contracts || number(known[2]) !== cohort.pinned || number(known[3]) !== cohort.size) failures.push('known-size cohort counts disagree');
  if (!known || cohort.pct === null || Number(/^([\d.]+)%$/.exec(known[4])?.[1]) !== Number(cohort.pct.toFixed(1))) failures.push('known-size cohort percentage disagrees or has no denominator');
  return failures;
}
