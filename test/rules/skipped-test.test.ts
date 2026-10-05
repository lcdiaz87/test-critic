import { describe, expect, it } from 'vitest';
import { analyzeFixture, findingsOf } from '../helpers/fixtures.js';

describe('skipped-test', () => {
  it('reports skipped and todo tests and skipped suites', () => {
    expect(findingsOf('skipped-test/triggers.test.ts', 'skipped-test')).toEqual([
      { line: 5, column: 3, testName: 'skips › is skipped with it.skip' },
      { line: 9, column: 3, testName: 'skips › is skipped with test.skip' },
      { line: 13, column: 3, testName: 'skips › is a placeholder' },
      { line: 20, column: 1, testName: 'a skipped suite' },
    ]);
  });

  it('reports xdescribe and xit in JavaScript files', () => {
    expect(findingsOf('skipped-test/triggers.test.js', 'skipped-test')).toEqual([
      { line: 3, column: 1, testName: 'legacy suite' },
      { line: 9, column: 1, testName: 'is skipped with xit' },
    ]);
  });

  it('reports Playwright test.fixme and test.describe.skip', () => {
    expect(findingsOf('skipped-test/triggers.spec.ts', 'skipped-test')).toEqual([
      { line: 3, column: 1, testName: 'exports the report' },
      { line: 7, column: 1, testName: 'billing' },
    ]);
  });

  it('uses warning severity and says how many tests a skipped suite hides', () => {
    const finding = analyzeFixture('skipped-test/triggers.test.ts').findings.find((f) => f.line === 20);
    expect(finding).toMatchObject({ severity: 'warning', message: 'This suite is skipped, so its 2 tests never run.' });
  });

  it('counts skipped tests, including those inside skipped suites, as unable to fail', () => {
    // 6 declared tests; only "still runs" can fail.
    expect(analyzeFixture('skipped-test/triggers.test.ts')).toMatchObject({ testCount: 6, cannotFailCount: 5 });
  });

  it.each([
    ['skipped-test/clean.test.ts', 3],
    ['skipped-test/clean.spec.ts', 2],
  ])('stays silent on conditional skips in %s', (path, tests) => {
    const analysis = analyzeFixture(path);
    expect(analysis.testCount).toBe(tests);
    expect(analysis.findings).toEqual([]);
  });
});
