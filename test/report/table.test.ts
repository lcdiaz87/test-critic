import { describe, expect, it } from 'vitest';
import { formatSummary, formatTable } from '../../src/report/table.js';
import type { Finding } from '../../src/types.js';

describe('formatSummary', () => {
  it('matches the headline format of the CLI contract', () => {
    expect(formatSummary({ tests: 120, placebos: 34, findings: 51, rules: 6 })).toBe(
      '120 tests analysed · 34 placebo (28%) · 51 findings across 6 rules',
    );
  });

  it('uses singular nouns for one and avoids dividing by zero', () => {
    expect(formatSummary({ tests: 1, placebos: 1, findings: 1, rules: 1 })).toBe(
      '1 test analysed · 1 placebo (100%) · 1 finding across 1 rule',
    );
    expect(formatSummary({ tests: 0, placebos: 0, findings: 0, rules: 0 })).toBe(
      '0 tests analysed · 0 placebo (0%) · 0 findings across 0 rules',
    );
  });
});

describe('formatTable', () => {
  const finding = (overrides: Partial<Finding>): Finding => ({
    ruleId: 'no-assertion',
    severity: 'error',
    file: 'a.test.ts',
    line: 1,
    column: 1,
    testName: 'a test',
    message: 'Why it matters.',
    ...overrides,
  });

  it('groups findings by file and aligns the columns within each group', () => {
    const table = formatTable([
      finding({ line: 5, column: 3, testName: 'math › adds' }),
      finding({ line: 12, column: 1, ruleId: 'skipped-test', severity: 'warning', testName: null, message: 'Skipped.' }),
      finding({ file: 'b.test.ts' }),
    ]);
    expect(table).toBe(
      [
        'a.test.ts',
        '  5:3   error    no-assertion  math › adds',
        '        Why it matters.',
        '  12:1  warning  skipped-test  (file)',
        '        Skipped.',
        '',
        'b.test.ts',
        '  1:1  error  no-assertion  a test',
        '       Why it matters.',
      ].join('\n'),
    );
  });
});
