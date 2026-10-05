import { extname } from 'node:path';
import { Node, Project, SyntaxKind, ts, type SourceFile } from 'ts-morph';
import { classifyCall } from './test-inventory.js';

export interface CommentedTest {
  /** Offset in the original file of the comment line where the commented test starts. */
  pos: number;
  /** Title of the first test found inside the comment. */
  title: string;
  /** How many test declarations the comment contains. */
  testCount: number;
}

// A candidate starting line must open with a test or suite call: `it(`, `test.skip(`, `describe.each(`...
const STARTS_LIKE_DECLARATION = /^\s*(?:it|test|xit|xtest|fit|describe|xdescribe|fdescribe|suite)\s*(?:\.\s*\w+\s*)*\(/;

interface CommentLine {
  /** Offset of the line's text in the original file. */
  pos: number;
  text: string;
}

/**
 * Finds commented-out tests: comments whose text, from some line onwards, is valid code made only of test or suite declarations.
 *
 * The bar is deliberately high, because comments are mostly prose:
 * - `// TODO: test('large input')` is not valid code, so it is ignored.
 * - `// Usage: test('x', () => {})` parses as a labelled statement, not a bare test call, so it is ignored.
 * - JSDoc blocks are documentation and are never inspected.
 * - A comment after code on the same line (`foo(); // it(...)`) is an annotation, not commented-out code.
 *
 * Consecutive `//` lines are joined, because that is how editors comment out a multi-line block.
 * Leading prose is allowed ("// Disabled until the API is back:" followed by the test), trailing prose is not.
 */
export function findCommentedTests(sourceFile: SourceFile): CommentedTest[] {
  const text = sourceFile.getFullText();
  const fileName = `comment${extname(sourceFile.getFilePath()) || '.ts'}`;
  const found: CommentedTest[] = [];
  let scratch: Project | undefined;

  for (const group of groupCommentLines(text, collectCommentRanges(sourceFile))) {
    for (let start = 0; start < group.length; start++) {
      const first = group[start];
      if (first === undefined || !STARTS_LIKE_DECLARATION.test(first.text)) continue;

      const code = group
        .slice(start)
        .map((line) => line.text)
        .join('\n');
      const { diagnostics = [] } = ts.transpileModule(code, { fileName, reportDiagnostics: true });
      if (diagnostics.length > 0) continue;

      scratch ??= new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true, noLib: true, noResolve: true } });
      const titles = testTitlesIfOnlyDeclarations(scratch.createSourceFile(fileName, code, { overwrite: true }));
      if (titles?.[0] !== undefined) {
        found.push({ pos: first.pos + (first.text.length - first.text.trimStart().length), title: titles[0], testCount: titles.length });
        break;
      }
    }
  }
  return found;
}

function collectCommentRanges(sourceFile: SourceFile): ts.CommentRange[] {
  const text = sourceFile.getFullText();
  const byPos = new Map<number, ts.CommentRange>();
  const addAll = (ranges: readonly ts.CommentRange[] | undefined): void => {
    for (const range of ranges ?? []) byPos.set(range.pos, range);
  };

  // Comments are trivia, not nodes, so we ask the scanner for the trivia around every node.
  // Leading ranges at a node's end catch comments before a closing brace, such as a commented test at the end of a describe block.
  const visit = (node: ts.Node): void => {
    addAll(ts.getLeadingCommentRanges(text, node.pos));
    addAll(ts.getTrailingCommentRanges(text, node.end));
    addAll(ts.getLeadingCommentRanges(text, node.end));
    ts.forEachChild(node, visit);
  };
  visit(sourceFile.compilerNode);

  // Text inside JSX looks like trivia to the scanner (`<p>// hi</p>`) but is content, so ranges inside JSX text are dropped.
  const jsxText = sourceFile.getDescendantsOfKind(SyntaxKind.JsxText).map((node) => [node.getPos(), node.getEnd()] as const);
  return [...byPos.values()]
    .filter((range) => !jsxText.some(([start, end]) => range.pos >= start && range.pos < end))
    .sort((a, b) => a.pos - b.pos);
}

/** Splits comments into groups of lines: one group per block comment, one per run of adjacent standalone `//` comments. */
function groupCommentLines(text: string, ranges: readonly ts.CommentRange[]): CommentLine[][] {
  const groups: CommentLine[][] = [];
  let run: CommentLine[] = [];
  let runEnd = -1;

  const flush = (): void => {
    if (run.length > 0) groups.push(run);
    run = [];
  };

  for (const range of ranges) {
    const raw = text.slice(range.pos, range.end);
    const lineStart = text.lastIndexOf('\n', range.pos - 1) + 1;
    const standalone = /^[ \t]*$/.test(text.slice(lineStart, range.pos));

    if (range.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
      flush();
      if (standalone && !raw.startsWith('/**')) groups.push(splitLines(raw.slice(2, -2), range.pos + 2));
      continue;
    }

    if (!standalone) {
      flush();
      continue;
    }
    const adjacent = run.length > 0 && /^[ \t]*\r?\n[ \t]*$/.test(text.slice(runEnd, range.pos));
    if (!adjacent) flush();
    run.push({ pos: range.pos + 2, text: raw.slice(2) });
    runEnd = range.end;
  }
  flush();
  return groups;
}

function splitLines(content: string, pos: number): CommentLine[] {
  const lines: CommentLine[] = [];
  let offset = 0;
  for (const line of content.split('\n')) {
    lines.push({ pos: pos + offset, text: line.replace(/\r$/, '') });
    offset += line.length + 1;
  }
  return lines;
}

/** Returns the test titles when every statement is a test or suite declaration, otherwise undefined. */
function testTitlesIfOnlyDeclarations(sourceFile: SourceFile): string[] | undefined {
  const statements = sourceFile.getStatements().filter((statement) => !Node.isEmptyStatement(statement));
  if (statements.length === 0) return undefined;

  for (const statement of statements) {
    if (!Node.isExpressionStatement(statement) || !isDeclaration(statement.getExpression())) return undefined;
  }

  const titles: string[] = [];
  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node) && classifyCall(node)?.kind === 'test' && isDeclaration(node)) {
      const [title] = node.getArguments();
      if (title !== undefined) {
        titles.push(Node.isStringLiteral(title) || Node.isNoSubstitutionTemplateLiteral(title) ? title.getLiteralText() : title.getText());
      }
    }
  });
  return titles;
}

/** A test or suite call with a title and an inline callback: the shape of a real declaration. */
function isDeclaration(node: Node): boolean {
  if (!Node.isCallExpression(node) || classifyCall(node) === undefined) return false;
  const [title, ...rest] = node.getArguments();
  if (title === undefined || Node.isArrowFunction(title) || Node.isFunctionExpression(title)) return false;
  return rest.some((arg) => Node.isArrowFunction(arg) || Node.isFunctionExpression(arg));
}
