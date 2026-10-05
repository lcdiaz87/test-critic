import { runnableTests, type Rule } from './rule.js';

/**
 * A test without assertions passes as long as nothing throws.
 * It adds coverage, but it cannot tell a correct result from a wrong one.
 *
 * This rule is strict by design: actions that might throw (`page.click()`, `getByRole()`, calling the code under test) do not count as assertions.
 * What counts is listed in `collectAssertionSites`: assertion calls, chai `should`, `throw`, a `done` callback that can receive an error, and helpers in the same file that assert.
 */
export const noAssertion: Rule = {
  id: 'no-assertion',
  severity: 'error',
  check: (context) =>
    runnableTests(context)
      .filter((test) => context.assertionSites(test).length === 0)
      .map((test) => ({
        pos: test.call.getStart(),
        test,
        message: 'This test has no assertion, so it passes whatever the code under test does.',
        makesTestUnableToFail: true,
      })),
};
