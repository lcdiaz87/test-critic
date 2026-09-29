import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXIT_FAILURE, EXIT_OK, main } from '../src/cli.js';
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

describe('main', () => {
  let project: ReturnType<typeof createTempProject>;

  beforeAll(() => {
    project = createTempProject({
      'a.test.ts': '',
      'b.spec.js': '',
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

  it('lists matched files and exits 0', async () => {
    const result = await runCli(['*.test.ts', '*.spec.js'], project.dir);
    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stdout).toBe('2 files matched:\n  a.test.ts\n  b.spec.js\n');
  });

  it('warns on stderr that --llm is not available and still runs', async () => {
    const result = await runCli(['*.test.ts', '--llm'], project.dir);
    expect(result.exitCode).toBe(EXIT_OK);
    expect(result.stderr).toContain('--llm is not available yet');
  });
});
