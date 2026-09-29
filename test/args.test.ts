import { describe, expect, it } from 'vitest';
import { parseCliArgs, UsageError } from '../src/args.js';

describe('parseCliArgs', () => {
  it('applies defaults when only globs are given', () => {
    expect(parseCliArgs(['src/**/*.test.ts', 'e2e/**/*.spec.ts'])).toEqual({
      kind: 'run',
      options: {
        patterns: ['src/**/*.test.ts', 'e2e/**/*.spec.ts'],
        format: 'table',
        minSeverity: 'warning',
        llm: false,
      },
    });
  });

  it('accepts --format in both "=value" and separate-argument forms', () => {
    expect(parseCliArgs(['a', '--format=sarif'])).toMatchObject({ options: { format: 'sarif' } });
    expect(parseCliArgs(['a', '--format', 'json'])).toMatchObject({ options: { format: 'json' } });
  });

  it('treats --json as --format=json', () => {
    expect(parseCliArgs(['a', '--json'])).toMatchObject({ options: { format: 'json' } });
    expect(parseCliArgs(['a', '--json', '--format=json'])).toMatchObject({ options: { format: 'json' } });
  });

  it('rejects --json combined with a different --format', () => {
    expect(() => parseCliArgs(['a', '--json', '--format=sarif'])).toThrow(
      new UsageError('--json conflicts with --format=sarif.'),
    );
  });

  it('parses --min-severity and --llm', () => {
    expect(parseCliArgs(['a', '--min-severity=error', '--llm'])).toMatchObject({
      options: { minSeverity: 'error', llm: true },
    });
  });

  it.each([
    [['a', '--format=xml'], /Invalid value for --format: "xml"/],
    [['a', '--min-severity=info'], /Invalid value for --min-severity: "info"/],
    [['a', '--nope'], /Unknown option '--nope'/],
    [[], /Missing file glob/],
  ])('rejects invalid input %j', (argv, message) => {
    expect(() => parseCliArgs(argv)).toThrow(UsageError);
    expect(() => parseCliArgs(argv)).toThrow(message);
  });

  it('returns help and version requests without requiring globs', () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['-h'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['--version'])).toEqual({ kind: 'version' });
  });
});
