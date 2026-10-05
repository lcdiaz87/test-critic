import { findCommentedTests } from '../engine/commented-tests.js';
import type { Rule, RuleHit } from './rule.js';

/**
 * A skipped test never runs, so it cannot catch a regression, however good its assertions are.
 *
 * Only declarations are reported: `it.skip(...)`, `xit(...)`, `it.todo(...)`, `describe.skip(...)`, Playwright's `test.fixme(...)`, and commented-out tests.
 * Runtime skips such as Playwright's `test.skip(browserName === 'webkit', 'reason')` or Vitest's `it.skipIf(cond)` are conditional by design and are not reported.
 *
 * Severity is `warning`: skipping is often deliberate and temporary, and a CI pipeline should not break because of it.
 * It still counts towards "cannot fail", because while skipped, the test protects nothing.
 */
export const skippedTest: Rule = {
  id: 'skipped-test',
  severity: 'warning',
  check: (context) => {
    const hits: RuleHit[] = [];

    for (const suite of context.inventory.suites) {
      if (suite.skip === undefined) continue;
      const inside = context.inventory.tests.filter((test) => test.call.getAncestors().includes(suite.call)).length;
      hits.push({
        pos: suite.call.getStart(),
        title: suite.title,
        message: `This suite is skipped, so its ${String(inside)} ${inside === 1 ? 'test never runs' : 'tests never run'}.`,
        makesTestUnableToFail: false,
      });
    }

    for (const test of context.inventory.tests) {
      if (test.skip === undefined) continue;
      hits.push({
        pos: test.call.getStart(),
        test,
        message:
          test.skip === 'todo'
            ? 'This test is a placeholder with no body, so it cannot catch a regression.'
            : 'This test is skipped, so it never runs and cannot catch a regression.',
        makesTestUnableToFail: true,
      });
    }

    for (const commented of findCommentedTests(context.sourceFile)) {
      hits.push({
        pos: commented.pos,
        title: commented.title,
        message:
          commented.testCount === 1
            ? 'This test is commented out, so it never runs and cannot catch a regression.'
            : `These ${String(commented.testCount)} tests are commented out, so they never run and cannot catch a regression.`,
        // A commented-out test is not code, so it is not among the tests analysed and does not move the percentage.
        makesTestUnableToFail: false,
      });
    }
    return hits;
  },
};
