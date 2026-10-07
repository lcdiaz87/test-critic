import { describe, expect, it } from 'vitest';
import { analyzeFixture, findingsOf } from '../helpers/fixtures.js';

describe('tautological-assertion', () => {
  it('reports literal comparisons, literal subjects and the same data on both sides', () => {
    expect(findingsOf('tautological-assertion/triggers.test.ts', 'tautological-assertion')).toEqual([
      { line: 6, column: 5, testName: 'tautologies › compares two literals' },
      { line: 11, column: 5, testName: 'tautologies › compares a variable with itself' },
      { line: 16, column: 5, testName: 'tautologies › checks that a literal is truthy' },
      { line: 20, column: 5, testName: 'tautologies › uses a soft assertion on a literal' },
      { line: 25, column: 5, testName: 'tautologies › hides a tautology next to a real assertion' },
      { line: 30, column: 5, testName: 'tautologies › compares a property with itself' },
      { line: 35, column: 5, testName: 'tautologies › compares a nested property and an index with themselves' },
      { line: 36, column: 5, testName: 'tautologies › compares a nested property and an index with themselves' },
      { line: 41, column: 5, testName: 'tautologies › reads a memoised getter twice' },
      { line: 45, column: 5, testName: 'tautologies › compares this.value with itself' },
    ]);
  });

  it.each([
    [11, 'total'],
    [30, 'config.port'],
    [36, 'user.roles[0]'],
  ])('names the data compared with itself on line %i', (line, path) => {
    const finding = analyzeFixture('tautological-assertion/triggers.test.ts').findings.find((f) => f.line === line);
    expect(finding).toMatchObject({
      severity: 'error',
      message: `This assertion compares \`${path}\` with itself, so it passes whatever the code under test does.`,
    });
  });

  it('only counts a test as unable to fail when all of its assertions are tautological', () => {
    // 9 tests, but "hides a tautology next to a real assertion" also has a real assertion and can still fail.
    expect(analyzeFixture('tautological-assertion/triggers.test.ts')).toMatchObject({ testCount: 9, cannotFailCount: 8 });
  });

  it('stays silent on calls, different values and assertions that always fail', () => {
    const analysis = analyzeFixture('tautological-assertion/clean.test.ts');
    expect(analysis.testCount).toBe(10);
    expect(analysis.findings).toEqual([]);
  });
});
