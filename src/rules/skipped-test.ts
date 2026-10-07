import type { Rule, RuleHit } from './rule.js';

/**
 * A skipped test never runs, so it cannot catch a regression, however good its assertions are.
 *
 * Only declarations are reported: `it.skip(...)`, `xit(...)`, `it.todo(...)`, `describe.skip(...)` and Playwright's `test.fixme(...)`.
 * Commented-out tests are planned for V2 (see ROADMAP-V2.md).
 * Runtime skips such as Playwright's `test.skip(browserName === 'webkit', 'reason')` or Vitest's `it.skipIf(cond)` are conditional by design and are not reported.
 *
 * Severity is `warning`: skipping is often deliberate and temporary, and a CI pipeline should not break because of it.
 * It still counts as a placebo, because while skipped, the test protects nothing.
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
        provesPlacebo: false,
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
        provesPlacebo: true,
      });
    }
    return hits;
  },
};
