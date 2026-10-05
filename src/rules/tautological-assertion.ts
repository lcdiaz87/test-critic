import { Node, SyntaxKind, type CallExpression } from 'ts-morph';
import { runnableTests, type Rule, type RuleHit } from './rule.js';

// Jest, Vitest and Playwright compare with Object.is (toBe) or deep equality (toEqual, toStrictEqual).
// For a value and itself, both are always true, including NaN.
const EQUALITY_MATCHERS = new Set(['toBe', 'toEqual', 'toStrictEqual']);

interface Static {
  value: unknown;
}

// Matchers without arguments whose result is known once the subject is a literal.
const UNARY_MATCHERS: Record<string, (value: unknown) => boolean> = {
  toBeTruthy: (value) => Boolean(value),
  toBeFalsy: (value) => !value,
  toBeDefined: (value) => value !== undefined,
  toBeUndefined: (value) => value === undefined,
  toBeNull: (value) => value === null,
};

/**
 * An assertion whose outcome is decided before the test runs: `expect(true).toBe(true)`, `expect(x).toEqual(x)`, `expect(1).toBeTruthy()`.
 *
 * Only two shapes are reported, because only these are guaranteed to pass:
 * - literals on both sides (or a literal subject with a matcher like `toBeTruthy`);
 * - the same plain variable on both sides.
 *
 * Property accesses are deliberately left out. `expect(store.state).toBe(store.state)` reads a getter twice, and checking that a memoised getter returns the same instance is a legitimate test that can fail.
 * Assertions that can never pass (`expect(x).not.toBe(x)`, `expect(1).toBe(2)`) are broken too, but they fail loudly, so they are not this rule's concern.
 */
export const tautologicalAssertion: Rule = {
  id: 'tautological-assertion',
  severity: 'error',
  check: (context) => {
    const hits: RuleHit[] = [];
    for (const test of runnableTests(context)) {
      const sites = context.assertionSites(test);
      const tautologies = sites.flatMap((site) => {
        const message = Node.isCallExpression(site.node) ? tautologyMessage(site.node) : undefined;
        return message === undefined ? [] : [{ node: site.node, message }];
      });
      // The test cannot fail only when every way it has of failing is a tautology.
      const allTautological = tautologies.length === sites.length;
      for (const { node, message } of tautologies) {
        hits.push({ pos: node.getStart(), test, message, makesTestUnableToFail: allTautological });
      }
    }
    return hits;
  },
};

function tautologyMessage(assertion: CallExpression): string | undefined {
  const matcherAccess = assertion.getExpression();
  if (!Node.isPropertyAccessExpression(matcherAccess)) return undefined;

  // The matcher must hang directly off expect(...): `.not`, `.resolves` or `.rejects` change the meaning.
  const subjectCall = matcherAccess.getExpression();
  if (!Node.isCallExpression(subjectCall) || !isExpectCallee(subjectCall.getExpression())) return undefined;
  const [subject, ...extraSubjects] = subjectCall.getArguments();
  if (subject === undefined || extraSubjects.length > 0) return undefined;

  const matcher = matcherAccess.getName();
  const matcherArgs = assertion.getArguments();

  if (EQUALITY_MATCHERS.has(matcher) && matcherArgs.length === 1 && matcherArgs[0] !== undefined) {
    const expected = matcherArgs[0];
    if (Node.isIdentifier(subject) && Node.isIdentifier(expected) && subject.getText() === expected.getText()) {
      return `This assertion compares \`${subject.getText()}\` with itself, so it passes whatever the code under test does.`;
    }
    const left = staticValue(subject);
    const right = staticValue(expected);
    if (left !== undefined && right !== undefined && Object.is(left.value, right.value)) {
      return 'This assertion only compares literal values, so its result is fixed before the test runs.';
    }
    return undefined;
  }

  const evaluate = UNARY_MATCHERS[matcher];
  if (evaluate !== undefined && matcherArgs.length === 0) {
    const value = staticValue(subject);
    if (value !== undefined && evaluate(value.value)) {
      return 'This assertion checks a literal value, so its result is fixed before the test runs.';
    }
  }
  return undefined;
}

/** `expect(...)` or `expect.soft(...)`. */
function isExpectCallee(callee: Node): boolean {
  if (Node.isIdentifier(callee)) return callee.getText() === 'expect';
  return (
    Node.isPropertyAccessExpression(callee) &&
    callee.getName() === 'soft' &&
    Node.isIdentifier(callee.getExpression()) &&
    callee.getExpression().getText() === 'expect'
  );
}

/** The value of a primitive literal, or undefined when the expression is not one. */
function staticValue(node: Node): Static | undefined {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return { value: node.getLiteralText() };
  if (Node.isNumericLiteral(node)) return { value: node.getLiteralValue() };
  if (node.isKind(SyntaxKind.TrueKeyword)) return { value: true };
  if (node.isKind(SyntaxKind.FalseKeyword)) return { value: false };
  if (node.isKind(SyntaxKind.NullKeyword)) return { value: null };
  if (Node.isIdentifier(node) && node.getText() === 'undefined') return { value: undefined };
  if (Node.isPrefixUnaryExpression(node) && node.getOperatorToken() === SyntaxKind.MinusToken) {
    const operand = node.getOperand();
    if (Node.isNumericLiteral(operand)) return { value: -operand.getLiteralValue() };
  }
  return undefined;
}
