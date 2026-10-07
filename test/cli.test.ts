import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXIT_FAILURE, EXIT_FINDINGS, EXIT_OK, main } from '../src/cli.js';
import { createTempProject } from './helpers/temp-project.js';

async function runCli(argv: string[], cwd: string) {
  let stdout = '';
  let stderr = '';
  const exitCode = await main(argv, {
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
    cwd,
  });
  return { exitCode, stdout, stderr };
}

const lines = (...content: string[]): string => content.join('\n');

describe('main', () => {
  let project: ReturnType<typeof createTempProject>;

  beforeAll(() => {
    project = createTempProject({
      'clean.test.ts': lines("it('adds', () => {", '  expect(1 + 1).toBe(2);', '});', ''),
      'weak.test.ts': lines(
        "it('adds', () => {",
        '  add(1, 1);',
        '});',
        '',
        "it.skip('later', () => {",
        '  expect(1).toBe(1);',
        '});',
        '',
      ),
      'skipped.spec.js': lines("test.skip('export', async () => {", "  await expect(page).toHaveTitle('x');", '});', ''),
      'broken.test.ts': lines("it('a', () => {", '  add(1,', '});', ''),
    });
  });

  afterAll(() => {
    project.cleanup();
  });

  it('prints usage and exits 0 for --help', async () => {
    const result = await runCli(['--help'], project.dir);
    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stdout).toMatch(/^Usage: test-critic <glob\.\.\.>/);
  });

  it('prints a semver version for --version', async () => {
    const result = await runCli(['--version'], project.dir);
    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it('exits 2 with the reason and usage on invalid arguments', async () => {
    const result = await runCli(['*.ts', '--format=xml'], project.dir);
    expect(result.exitCode).toBe(EXIT_FAILURE);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Invalid value for --format: "xml"');
    expect(result.stderr).toContain('Usage:');
  });

  it('exits 2 when no files match', async () => {
    const result = await runCli(['nothing/**/*.ts'], project.dir);
    expect(result.exitCode).toBe(EXIT_FAILURE);
    expect(result.stderr).toContain('No test files matched: nothing/**/*.ts');
  });

  it('prints only the summary and exits 0 when nothing is wrong', async () => {
    const result = await runCli(['clean.test.ts'], project.dir);
    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stdout).toBe('1 test analysed · 0 placebo (0%) · 0 findings across 0 rules\n');
  });

  it('prints the table and the summary, and exits 1 when there is an error-severity finding', async () => {
    const result = await runCli(['weak.test.ts'], project.dir);
    expect(result.exitCode).toBe(EXIT_FINDINGS);
    expect(result.stdout).toBe(
      lines(
        'weak.test.ts',
        '  1:1  error    no-assertion  adds',
        '       This test has no assertion, so it passes whatever the code under test does.',
        '  5:1  warning  skipped-test  later',
        '       This test is skipped, so it never runs and cannot catch a regression.',
        '',
        '2 tests analysed · 2 placebo (100%) · 2 findings across 2 rules',
        '',
      ),
    );
  });

  it('exits 0 when every finding is a warning', async () => {
    const result = await runCli(['skipped.spec.js'], project.dir);
    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stdout).toContain('1 test analysed · 1 placebo (100%) · 1 finding across 1 rule');
  });

  it('hides warnings with --min-severity=error but keeps the placebo headline', async () => {
    const result = await runCli(['weak.test.ts', '--min-severity=error'], project.dir);
    expect(result.exitCode).toBe(EXIT_FINDINGS);
    expect(result.stdout).not.toContain('skipped-test');
    expect(result.stdout).toContain('2 tests analysed · 2 placebo (100%) · 1 finding across 1 rule');
  });

  it('warns about files that do not parse and analyses the rest', async () => {
    const result = await runCli(['broken.test.ts', 'clean.test.ts'], project.dir);
    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stderr).toMatch(/^test-critic: Skipped broken\.test\.ts: syntax error on line 3 /);
    expect(result.stdout).toContain('1 test analysed');
  });

  it('exits 2 for output formats that are not implemented yet', async () => {
    const result = await runCli(['clean.test.ts', '--json'], project.dir);
    expect(result.exitCode).toBe(EXIT_FAILURE);
    expect(result.stderr).toContain('--format=json is not implemented yet');
  });

  it('warns on stderr that --llm is not available and still runs', async () => {
    const result = await runCli(['clean.test.ts', '--llm'], project.dir);
    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stderr).toContain('--llm is not available yet');
  });
});
