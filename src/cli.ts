import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseCliArgs, UsageError, USAGE, type CliOptions } from './args.js';
import { discoverFiles } from './discover.js';
import { analyzeSources } from './engine/analyze.js';
import { formatSummary, formatTable } from './report/table.js';
import { isAtLeast } from './types.js';

export const EXIT_OK = 0;
export const EXIT_FINDINGS = 1;
export const EXIT_FAILURE = 2;

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  cwd: string;
}

/** Runs the CLI and returns the process exit code. Never throws. */
export async function main(argv: readonly string[], io: CliIO): Promise<number> {
  try {
    const parsed = parseCliArgs(argv);
    switch (parsed.kind) {
      case 'help':
        io.stdout(USAGE);
        return EXIT_OK;
      case 'version':
        io.stdout(`${readVersion()}\n`);
        return EXIT_OK;
      case 'run':
        return await run(parsed.options, io);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`test-critic: ${error.message}\n\n${USAGE}`);
    } else {
      io.stderr(`test-critic: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    }
    return EXIT_FAILURE;
  }
}

async function run(options: CliOptions, io: CliIO): Promise<number> {
  if (options.llm) {
    io.stderr('test-critic: --llm is not available yet; running deterministic analysis only.\n');
  }

  if (options.format !== 'table') {
    io.stderr(`test-critic: --format=${options.format} is not implemented yet.\n`);
    return EXIT_FAILURE;
  }

  const files = await discoverFiles(options.patterns, io.cwd);
  if (files.length === 0) {
    io.stderr(`test-critic: No test files matched: ${options.patterns.join(' ')}\n`);
    return EXIT_FAILURE;
  }

  const sources = await Promise.all(
    files.map(async (file) => ({ file, text: await readFile(join(io.cwd, file), 'utf8') })),
  );
  const result = analyzeSources(sources);

  for (const failure of result.parseFailures) {
    io.stderr(`test-critic: Skipped ${failure.file}: syntax error on line ${String(failure.line)} (${failure.message})\n`);
  }

  const findings = result.files
    .flatMap((file) => file.findings)
    .filter((finding) => isAtLeast(finding.severity, options.minSeverity));

  if (findings.length > 0) io.stdout(`${formatTable(findings)}\n\n`);
  io.stdout(
    `${formatSummary({
      tests: sum(result.files.map((file) => file.testCount)),
      // The headline counts every test that cannot fail, whatever --min-severity hides from the table.
      cannotFail: sum(result.files.map((file) => file.cannotFailCount)),
      findings: findings.length,
      rules: new Set(findings.map((finding) => finding.ruleId)).size,
    })}\n`,
  );

  return findings.some((finding) => finding.severity === 'error') ? EXIT_FINDINGS : EXIT_OK;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function readVersion(): string {
  // Resolves to the package root from both src/ (tests) and dist/ (published build).
  const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  return (JSON.parse(raw) as { version: string }).version;
}
