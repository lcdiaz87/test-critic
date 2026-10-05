import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type SourceFile,
} from 'ts-morph';

export type TestCallback = ArrowFunction | FunctionExpression | FunctionDeclaration;

/** `skip` covers `.skip`, `.fixme` and the `x` prefixes; `todo` is a placeholder with no body. */
export type SkipMarker = 'skip' | 'todo';

export interface Suite {
  /** Full title, including enclosing suites. */
  title: string;
  call: CallExpression;
  skip: SkipMarker | undefined;
  /** True when this suite or any enclosing suite is skipped. */
  skipped: boolean;
}

export interface TestCase {
  /** Full title, including enclosing suites. */
  title: string;
  call: CallExpression;
  /** The function the runner executes, when it can be resolved statically. */
  callback: TestCallback | undefined;
  skip: SkipMarker | undefined;
  /** True when this test or any enclosing suite is skipped: the body never runs. */
  skipped: boolean;
  /** `it.fails` / `it.failing`: the test passes only when its body throws, so "no assertion" means something else. */
  expectsFailure: boolean;
  /** `it.each` / `test.for`: callback parameters are table rows, not a `done` callback. */
  parameterized: boolean;
}

export interface TestInventory {
  tests: TestCase[];
  suites: Suite[];
}

export interface CallShape {
  kind: 'test' | 'suite';
  root: string;
  modifiers: string[];
}

export const TITLE_SEPARATOR = ' › ';

const TEST_ROOTS = new Set(['it', 'test', 'fit', 'xit', 'xtest']);
const SUITE_ROOTS = new Set(['describe', 'fdescribe', 'xdescribe', 'suite']);

// Only modifiers we understand are accepted. Anything else (`test.step`, `test.use`, `test.beforeEach`, `test.extend`...)
// is not a test declaration, and treating an unknown call as a test is exactly the kind of guess that produces false positives.
const TEST_MODIFIERS = new Set([
  'only', 'skip', 'todo', 'fixme', 'fails', 'failing', 'concurrent', 'sequential', 'each', 'for', 'skipIf', 'runIf',
]);
const SUITE_MODIFIERS = new Set([
  'only', 'skip', 'todo', 'fixme', 'concurrent', 'sequential', 'shuffle', 'serial', 'parallel', 'each', 'for', 'skipIf', 'runIf',
]);

// Modifiers that return a new test function instead of registering a test: `it.each(table)('name', fn)`.
const CURRIED_MODIFIERS = new Set(['each', 'for', 'skipIf', 'runIf']);

/**
 * Recognises test and suite declarations purely from syntax.
 * It does not check whether the root identifier is shadowed; `collectTests` does that for real files.
 */
export function classifyCall(call: CallExpression): CallShape | undefined {
  const callee = call.getExpression();
  const curried = Node.isCallExpression(callee) || Node.isTaggedTemplateExpression(callee);
  const names = calleeNames(callee);
  if (names === undefined) return undefined;

  // `it.each(table)` on its own only builds a function; the test is registered by the outer call.
  const last = names.at(-1);
  const endsCurried = last !== undefined && CURRIED_MODIFIERS.has(last);
  if (curried !== endsCurried) return undefined;

  const [root, ...rest] = names;
  if (root === undefined) return undefined;

  let kind: CallShape['kind'];
  let modifiers: string[];
  if (SUITE_ROOTS.has(root)) {
    kind = 'suite';
    modifiers = rest;
  } else if (root === 'test' && rest[0] === 'describe') {
    // Playwright: test.describe(...), test.describe.serial(...)
    kind = 'suite';
    modifiers = rest.slice(1);
  } else if (TEST_ROOTS.has(root)) {
    kind = 'test';
    modifiers = rest;
  } else {
    return undefined;
  }

  const allowed = kind === 'suite' ? SUITE_MODIFIERS : TEST_MODIFIERS;
  if (!modifiers.every((modifier) => allowed.has(modifier))) return undefined;
  return { kind, root, modifiers };
}

export function skipMarkerOf(shape: CallShape): SkipMarker | undefined {
  if (shape.modifiers.includes('todo')) return 'todo';
  if (shape.root.startsWith('x') || shape.modifiers.includes('skip') || shape.modifiers.includes('fixme')) return 'skip';
  return undefined;
}

/**
 * Finds every test and suite declared in a file.
 * A call only counts as a test when it has a title and either a callback or a `.todo` marker, so runtime calls such as Playwright's `test.skip(condition, reason)` are not mistaken for declarations.
 */
export function collectTests(sourceFile: SourceFile): TestInventory {
  const shadowed = locallyDeclaredNames(sourceFile);
  const suitesByCall = new Map<CallExpression, Suite>();
  const tests: TestCase[] = [];

  // forEachDescendant visits parents before children, so enclosing suites are always registered first.
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const shape = classifyCall(node);
    if (shape === undefined || shadowed.has(shape.root)) return;

    const args = node.getArguments();
    const titleArg = args[0];
    if (titleArg === undefined || isFunctionLike(titleArg)) return;

    const parent = enclosingSuite(node, suitesByCall);
    const title = parent === undefined ? titleOf(titleArg) : parent.title + TITLE_SEPARATOR + titleOf(titleArg);
    const skip = skipMarkerOf(shape);
    const skipped = skip !== undefined || parent?.skipped === true;
    const callback = findCallback(args.slice(1), sourceFile);

    if (shape.kind === 'suite') {
      if (callback === undefined) return;
      suitesByCall.set(node, { title, call: node, skip, skipped });
      return;
    }

    if (callback === undefined && skip !== 'todo') return;
    tests.push({
      title,
      call: node,
      callback,
      skip,
      skipped,
      expectsFailure: shape.modifiers.includes('fails') || shape.modifiers.includes('failing'),
      parameterized: shape.modifiers.includes('each') || shape.modifiers.includes('for'),
    });
  });

  return { tests, suites: [...suitesByCall.values()] };
}

/** Resolves a function declared in this file by name, for callbacks and helpers passed by reference. */
export function resolveLocalFunctions(sourceFile: SourceFile, name: string): TestCallback[] {
  const found: TestCallback[] = [];
  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
    if (declaration.getName() === name) found.push(declaration);
  }
  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const initializer = declaration.getInitializer();
    if (declaration.getName() === name && initializer !== undefined && isFunctionLike(initializer)) {
      found.push(initializer);
    }
  }
  return found;
}

function calleeNames(expression: Node): string[] | undefined {
  if (Node.isIdentifier(expression)) return [expression.getText()];
  if (Node.isPropertyAccessExpression(expression)) {
    const object = calleeNames(expression.getExpression());
    return object === undefined ? undefined : [...object, expression.getName()];
  }
  if (Node.isTaggedTemplateExpression(expression)) return calleeNames(expression.getTag());
  if (Node.isCallExpression(expression)) {
    // Calls are only allowed in the middle of a chain after a curried modifier: it.skipIf(cond).each(table)
    const inner = calleeNames(expression.getExpression());
    const last = inner?.at(-1);
    return last !== undefined && CURRIED_MODIFIERS.has(last) ? inner : undefined;
  }
  return undefined;
}

function enclosingSuite(node: Node, suitesByCall: ReadonlyMap<CallExpression, Suite>): Suite | undefined {
  for (const ancestor of node.getAncestors()) {
    if (Node.isCallExpression(ancestor)) {
      const suite = suitesByCall.get(ancestor);
      if (suite !== undefined) return suite;
    }
  }
  return undefined;
}

function titleOf(node: Node): string {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  // `adds ${a} and ${b}`: show the template without its backticks, placeholders included.
  if (Node.isTemplateExpression(node)) return node.getText().slice(1, -1);
  return node.getText();
}

function findCallback(args: readonly Node[], sourceFile: SourceFile): TestCallback | undefined {
  // Inline functions first: Jest allows a timeout after the callback, Playwright a details object before it.
  for (const arg of args) {
    if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) return arg;
  }
  for (const arg of args) {
    if (Node.isIdentifier(arg)) {
      const [only, ...others] = resolveLocalFunctions(sourceFile, arg.getText());
      if (only !== undefined && others.length === 0) return only;
    }
  }
  return undefined;
}

function isFunctionLike(node: Node): node is ArrowFunction | FunctionExpression {
  return Node.isArrowFunction(node) || Node.isFunctionExpression(node);
}

/**
 * Names bound by a local declaration in this file.
 * If a file defines its own `test` or `it` (a helper, or `const test = base.extend(...)`), we cannot know what it does, so calls to it are not treated as tests.
 * Bindings from `require(...)` are the CommonJS form of an import and do not count.
 */
function locallyDeclaredNames(sourceFile: SourceFile): Set<string> {
  const names = new Set<string>();
  const addBinding = (name: Node): void => {
    if (Node.isIdentifier(name)) {
      names.add(name.getText());
      return;
    }
    for (const element of name.getDescendantsOfKind(SyntaxKind.BindingElement)) {
      const elementName = element.getNameNode();
      if (Node.isIdentifier(elementName)) names.add(elementName.getText());
    }
  };

  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    if (!isRequireCall(declaration.getInitializer())) addBinding(declaration.getNameNode());
  }
  for (const parameter of sourceFile.getDescendantsOfKind(SyntaxKind.Parameter)) {
    addBinding(parameter.getNameNode());
  }
  for (const declaration of [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration),
  ]) {
    const name = declaration.getName();
    if (name !== undefined) names.add(name);
  }
  return names;
}

function isRequireCall(node: Node | undefined): boolean {
  if (node === undefined) return false;
  if (Node.isPropertyAccessExpression(node)) return isRequireCall(node.getExpression());
  return Node.isCallExpression(node) && node.getExpression().getText() === 'require';
}
