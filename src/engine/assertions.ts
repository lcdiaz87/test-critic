import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import { resolveLocalFunctions, type TestCallback } from './test-inventory.js';

/**
 * Something inside a test that can make it fail on purpose.
 * - `assertion`: a call such as `expect(x).toBe(y)`, `assert.equal(a, b)` or `sinon.assert.calledOnce(spy)`.
 * - `should`: a chai `should` chain, which asserts through property access.
 * - `throw`: a manual `throw`, the oldest assertion there is.
 * - `callback`: the test reports failure through its `done` callback.
 * - `helper`: a call to a function declared in the same file that itself asserts.
 */
export interface AssertionSite {
  kind: 'assertion' | 'should' | 'throw' | 'callback' | 'helper';
  node: Node;
}

const ASSERTION_NAMES = new Set(['expect', 'assert', 'should']);

// expectValidUser(user), assertSorted(list), page.assertVisible(): by convention these assert.
// Requiring an uppercase letter, digit or underscore after the prefix keeps `expected` or `assertion` out.
const ASSERTION_HELPER_NAME = /^(?:expect|assert)[A-Z0-9_]/;

/**
 * Collects every assertion site inside a test callback, including nested functions.
 *
 * Nested functions are included on purpose: `items.forEach((item) => expect(item).toBeTruthy())` asserts.
 * The price is that an assertion inside a callback that never runs is still counted, which can hide a real problem but never invents one.
 */
export function collectAssertionSites(callback: TestCallback, parameterized: boolean): AssertionSite[] {
  const sourceFile = callback.getSourceFile();
  const sites = new Map<Node, AssertionSite>();
  const add = (kind: AssertionSite['kind'], node: Node): void => {
    if (!sites.has(node)) sites.set(node, { kind, node });
  };

  const body = callback.getBody();
  if (body === undefined) return [];

  const visit = (node: Node): void => {
    if (Node.isCallExpression(node)) {
      if (isAssertionCall(node)) add('assertion', chainTop(node));
      else if (callsAssertingLocalHelper(node, sourceFile, new Set())) add('helper', node);
    } else if (Node.isPropertyAccessExpression(node) && node.getName() === 'should') {
      add('should', chainTop(node));
    } else if (Node.isThrowStatement(node)) {
      add('throw', node);
    }
  };
  visit(body);
  body.forEachDescendant(visit);

  for (const node of completionCallbackSignals(callback, parameterized)) add('callback', node);
  return [...sites.values()];
}

/** True when the callee chain names an assertion library or follows the assertion helper convention. */
export function isAssertionCall(call: CallExpression): boolean {
  const names = calleeSpine(call.getExpression());
  return names.some((name) => ASSERTION_NAMES.has(name) || ASSERTION_HELPER_NAME.test(name));
}

/**
 * Climbs from a call to the outermost expression of its chain.
 * In `expect(x).not.toBe(y)` the inner `expect(x)` and the outer `.toBe(y)` are one assertion, reported at the outer call.
 */
export function chainTop(node: Node): Node {
  let current = node;
  for (;;) {
    const parent = current.getParent();
    const continuesChain =
      parent !== undefined &&
      ((Node.isPropertyAccessExpression(parent) && parent.getExpression() === current) ||
        (Node.isElementAccessExpression(parent) && parent.getExpression() === current) ||
        (Node.isCallExpression(parent) && parent.getExpression() === current) ||
        Node.isNonNullExpression(parent));
    if (!continuesChain) return current;
    current = parent;
  }
}

/** Identifiers along the left spine of a callee: `a.b(c).d` gives ['a', 'b', 'd']. */
function calleeSpine(expression: Node): string[] {
  if (Node.isIdentifier(expression)) return [expression.getText()];
  if (Node.isPropertyAccessExpression(expression)) return [...calleeSpine(expression.getExpression()), expression.getName()];
  if (Node.isElementAccessExpression(expression)) return calleeSpine(expression.getExpression());
  if (Node.isCallExpression(expression)) return calleeSpine(expression.getExpression());
  if (Node.isNonNullExpression(expression) || Node.isParenthesizedExpression(expression)) {
    return calleeSpine(expression.getExpression());
  }
  return [];
}

function callsAssertingLocalHelper(call: CallExpression, sourceFile: SourceFile, visiting: Set<string>): boolean {
  const callee = call.getExpression();
  if (!Node.isIdentifier(callee)) return false;
  const name = callee.getText();
  // Guards against recursive helpers: a helper that only calls itself proves nothing.
  if (visiting.has(name)) return false;
  visiting.add(name);

  return resolveLocalFunctions(sourceFile, name).some((helper) => {
    const body = helper.getBody();
    if (body === undefined) return false;
    return [body, ...body.getDescendants()].some(
      (node) =>
        Node.isThrowStatement(node) ||
        (Node.isPropertyAccessExpression(node) && node.getName() === 'should') ||
        (Node.isCallExpression(node) && (isAssertionCall(node) || callsAssertingLocalHelper(node, sourceFile, visiting))),
    );
  });
}

/**
 * Finds places where a `done`-style parameter is used in a way that can report a failure.
 *
 * `done(error)` and `done.fail(...)` fail the test, and `server.close(done)` hands `done` to code that may call it with an error.
 * A bare `done()` only says "finished" and asserts nothing.
 * Parameterized tests (`it.each`) receive table rows as parameters, so passing one of them to a function proves nothing and is not counted.
 */
function completionCallbackSignals(callback: TestCallback, parameterized: boolean): Node[] {
  const body = callback.getBody();
  if (body === undefined) return [];

  const names = new Set(
    callback
      .getParameters()
      .map((parameter) => parameter.getNameNode())
      .filter((name) => Node.isIdentifier(name))
      .map((name) => name.getText()),
  );
  if (names.size === 0) return [];

  return body.getDescendantsOfKind(SyntaxKind.Identifier).filter((identifier) => {
    if (!names.has(identifier.getText())) return false;
    const parent = identifier.getParent();
    if (Node.isCallExpression(parent) && parent.getExpression() === identifier) return parent.getArguments().length > 0;
    if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === identifier) return parent.getName() === 'fail';
    if (Node.isCallExpression(parent) && !parameterized) return parent.getArguments().includes(identifier);
    return false;
  });
}
