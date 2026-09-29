import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { discoverFiles } from '../src/discover.js';
import { createTempProject } from './helpers/temp-project.js';

describe('discoverFiles', () => {
  let project: ReturnType<typeof createTempProject>;

  beforeAll(() => {
    project = createTempProject({
      'src/math.test.ts': '',
      'src/math.ts': '',
      'src/ui/button.test.tsx': '',
      'src/legacy/old.test.js': '',
      'src/legacy/old.test.mjs': '',
      'src/types.d.ts': '',
      'src/notes.md': '',
      'e2e/login.spec.ts': '',
      'node_modules/some-lib/index.test.ts': '',
      'packages/a/node_modules/dep/x.test.ts': '',
    });
  });

  afterAll(() => {
    project.cleanup();
  });

  it('expands globs to sorted, relative, forward-slash paths', async () => {
    expect(await discoverFiles(['src/**/*.test.*'], project.dir)).toEqual([
      'src/legacy/old.test.js',
      'src/legacy/old.test.mjs',
      'src/math.test.ts',
      'src/ui/button.test.tsx',
    ]);
  });

  it('de-duplicates files matched by several patterns', async () => {
    expect(await discoverFiles(['e2e/*.spec.ts', 'e2e/**/*', 'e2e/login.spec.ts'], project.dir)).toEqual([
      'e2e/login.spec.ts',
    ]);
  });

  it('expands a directory to its supported source files, skipping declarations and non-code', async () => {
    const files = await discoverFiles(['src'], project.dir);
    expect(files).toContain('src/math.ts');
    expect(files).not.toContain('src/types.d.ts');
    expect(files).not.toContain('src/notes.md');
  });

  it('never descends into node_modules, even when explicitly globbed', async () => {
    const files = await discoverFiles(['**/*.test.ts'], project.dir);
    expect(files.some((file) => file.includes('node_modules'))).toBe(false);
    expect(files).toContain('src/math.test.ts');
  });

  it('returns an empty list when nothing matches', async () => {
    expect(await discoverFiles(['does-not-exist/**/*.ts'], project.dir)).toEqual([]);
  });
});
