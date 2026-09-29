import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Creates a throwaway directory tree from a `{ relativePath: contents }` map. */
export function createTempProject(files: Record<string, string>): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'test-critic-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = join(dir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, contents);
  }
  return { dir, cleanup: () => { rmSync(dir, { recursive: true, force: true }); } };
}
