import { extname } from 'node:path';
import { Project, ts, type SourceFile } from 'ts-morph';

const SCRIPT_KIND_BY_EXTENSION: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.mts': ts.ScriptKind.TS,
  '.cts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.js': ts.ScriptKind.JS,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
  '.jsx': ts.ScriptKind.JSX,
};

export interface SourceInput {
  /** Path relative to the working directory, with forward slashes. */
  file: string;
  text: string;
}

export interface ParseFailure {
  file: string;
  line: number;
  message: string;
}

export type ParsedSource = { ok: true; file: string; sourceFile: SourceFile } | ({ ok: false } & ParseFailure);

/**
 * Parses every input into a ts-morph SourceFile, rejecting files with syntax errors.
 *
 * The project lives in memory and never type-checks: we only need the syntax tree.
 * `noLib` and `noResolve` stop the compiler from loading lib.d.ts or following imports, which keeps parsing fast and independent of whatever the audited project has installed.
 */
export function parseSources(inputs: readonly SourceInput[]): ParsedSource[] {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, noLib: true, noResolve: true, types: [] },
  });

  const sourceFiles = inputs.map((input) =>
    project.createSourceFile(input.file, input.text, {
      overwrite: true,
      scriptKind: SCRIPT_KIND_BY_EXTENSION[extname(input.file)] ?? ts.ScriptKind.TS,
    }),
  );

  // Build the program once, after all files are added: ts-morph rebuilds it whenever the project changes.
  const program = project.getProgram();

  return sourceFiles.map((sourceFile, index) => {
    const file = inputs[index]?.file ?? sourceFile.getFilePath();
    // The TypeScript parser is error-tolerant and always returns a tree, even for broken code.
    // Analysing a half-parsed tree is how false positives happen, so a file with any syntax error is skipped entirely.
    const [firstError] = program.getSyntacticDiagnostics(sourceFile);
    if (firstError !== undefined) {
      const start = firstError.getStart();
      return {
        ok: false,
        file,
        line: sourceFile.getLineAndColumnAtPos(start).line,
        message: ts.flattenDiagnosticMessageText(firstError.compilerObject.messageText, ' '),
      };
    }
    return { ok: true, file, sourceFile };
  });
}
