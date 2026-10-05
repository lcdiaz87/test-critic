import { describe, expect, it } from 'vitest';
import { analyzeFixture, findingsOf } from '../helpers/fixtures.js';

describe('no-assertion', () => {
  it('reports every test without an assertion, including each-tests and a bare done()', () => {
    expect(findingsOf('no-assertion/triggers.test.ts', 'no-assertion')).toEqual([
      { line: 5, column: 3, testName: 'math › adds numbers' },
      { line: 9, column: 3, testName: 'math › loads a user without crashing' },
      { line: 13, column: 3, testName: 'math › has an empty body' },
      { line: 15, column: 3, testName: 'math › doubles %i' },
      { line: 19, column: 3, testName: 'math › only signals completion through done' },
    ]);
  });

  it('reports Playwright tests that only perform actions, because implicit assertions do not count', () => {
    expect(findingsOf('no-assertion/triggers.spec.ts', 'no-assertion')).toEqual([
      { line: 4, column: 1, testName: 'saves the profile' },
    ]);
  });

  it('reports with error severity and explains why', () => {
    const [finding] = analyzeFixture('no-assertion/triggers.spec.ts').findings;
    expect(finding).toMatchObject({
      severity: 'error',
      message: 'This test has no assertion, so it passes whatever the code under test does.',
    });
  });

  it('counts every reported test as unable to fail', () => {
    expect(analyzeFixture('no-assertion/triggers.test.ts')).toMatchObject({ testCount: 5, cannotFailCount: 5 });
  });

  // Each clean fixture must contain tests; otherwise "no findings" would prove nothing.
  it.each([
    ['no-assertion/clean.test.ts', 16],
    ['no-assertion/clean.spec.ts', 3],
  ])('stays silent on every assertion style in %s', (path, tests) => {
    const analysis = analyzeFixture(path);
    expect(analysis.testCount).toBe(tests);
    expect(analysis.findings).toEqual([]);
  });

  it('ignores calls to a locally defined `it`, since it may not be a test runner at all', () => {
    expect(analyzeFixture('no-assertion/shadowed.test.ts')).toMatchObject({ testCount: 0, findings: [] });
  });
});
