import { parseArgs } from 'node:util';
import { SEVERITIES, type Severity } from './types.js';

export const FORMATS = ['table', 'json', 'sarif'] as const;
export type OutputFormat = (typeof FORMATS)[number];

export interface CliOptions {
  patterns: string[];
  format: OutputFormat;
  minSeverity: Severity;
  llm: boolean;
}

export type ParsedArgs =
  | { kind: 'run'; options: CliOptions }
  | { kind: 'help' }
  | { kind: 'version' };

/** Invalid command-line input. Always maps to exit code 2. */
export class UsageError extends Error {
  override name = 'UsageError';
}

export const USAGE = `Usage: test-critic <glob...> [options]

Find tests that cannot fail in Jest, Vitest and Playwright test files.

Options:
  --format <table|json|sarif>      Output format (default: table)
  --json                           Shorthand for --format=json
  --min-severity <warning|error>   Only report findings at or above this severity (default: warning)
  --llm                            Enable the optional LLM layer (off by default)
  -h, --help                       Show this help
  -v, --version                    Show the version

Exit codes:
  0  no error-severity findings
  1  at least one error-severity finding
  2  execution error (invalid arguments, no matching files, crash)
`;

export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        format: { type: 'string' },
        json: { type: 'boolean', default: false },
        'min-severity': { type: 'string' },
        llm: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
  } catch (error) {
    // node:util throws TypeError with a readable message for unknown or malformed options.
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }

  const { values, positionals } = parsed;

  if (values.help) return { kind: 'help' };
  if (values.version) return { kind: 'version' };

  if (positionals.length === 0) {
    throw new UsageError('Missing file glob. Pass at least one pattern, e.g. "src/**/*.test.ts".');
  }

  const format = parseChoice('--format', values.format, FORMATS) ?? (values.json ? 'json' : 'table');
  if (values.json && format !== 'json') {
    throw new UsageError(`--json conflicts with --format=${format}.`);
  }

  return {
    kind: 'run',
    options: {
      patterns: positionals,
      format,
      minSeverity: parseChoice('--min-severity', values['min-severity'], SEVERITIES) ?? 'warning',
      llm: values.llm,
    },
  };
}

function parseChoice<T extends string>(
  flag: string,
  value: string | undefined,
  choices: readonly T[],
): T | undefined {
  if (value === undefined) return undefined;
  const match = choices.find((choice) => choice === value);
  if (match === undefined) {
    throw new UsageError(`Invalid value for ${flag}: "${value}". Expected one of: ${choices.join(', ')}.`);
  }
  return match;
}
