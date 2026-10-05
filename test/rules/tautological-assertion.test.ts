import { describe, expect, it } from 'vitest';
import { analyzeFixture, findingsOf } from '../helpers/fixtures.js';

describe('tautological-assertion', () => {
  it('reports literal comparisons, self comparisons and literal subjects', () => {
    expect(findingsOf('tautological-assertion/triggers.test.ts', 'tautological-assertion')).toEqual([
      { line: 6, column: 5, testName: 'tautologies › compares two literals' },
      { line: 11, column: 5, testName: 'tautologies › compares a variable with itself' },
      { line: 16, column: 5, testName: 'tautologies › checks that a literal is truthy' },
      { line: 20, column: 5, testName: 'tautologies › uses a soft assertion on a literal' },
      { line: 25, column: 5, testName: 'tautologies › hides a tautology next to a real assertion' },
    ]);
  });

  it('names the variable compared with itself', () => {
    const finding = analyzeFixture('tautological-assertion/triggers.test.ts').findings.find((f) => f.line === 11);
    expect(finding).toMatchObject({
      severity: 'error',
      message: 'This assertion compares `total` with itself, so it passes whatever the code under test does.',
    });
  });

  it('only counts a test as unable to fail when all of its assertions are tautological', () => {
    // 5 tests, but the last one also has a real assertion and can still fail.
    expect(analyzeFixture('tautological-assertion/triggers.test.ts')).toMatchObject({ testCount: 5, cannotFailCount: 4 });
  });

  it('stays silent on property accesses, different values and assertions that always fail', () => {
    const analysis = analyzeFixture('tautological-assertion/clean.test.ts');
    expect(analysis.testCount).toBe(7);
    expect(analysis.findings).toEqual([]);
  });
});
