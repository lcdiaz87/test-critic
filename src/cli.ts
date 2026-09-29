import { readFileSync } from 'node:fs';
import { parseCliArgs, UsageError, USAGE, type CliOptions } from './args.js';
import { discoverFiles } from './discover.js';

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

  const files = await discoverFiles(options.patterns, io.cwd);
  if (files.length === 0) {
    io.stderr(`test-critic: No test files matched: ${options.patterns.join(' ')}\n`);
    return EXIT_FAILURE;
  }

  // Analysis is not implemented yet; report what would be analysed.
  io.stdout(`${String(files.length)} file${files.length === 1 ? '' : 's'} matched:\n`);
  for (const file of files) io.stdout(`  ${file}\n`);
  return EXIT_OK;
}

function readVersion(): string {
  // Resolves to the package root from both src/ (tests) and dist/ (published build).
  const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  return (JSON.parse(raw) as { version: string }).version;
}
