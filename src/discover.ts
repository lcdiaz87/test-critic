import { glob } from 'tinyglobby';

const SUPPORTED_EXTENSION = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const DECLARATION_FILE = /\.d\.[cm]?ts$/;

/**
 * Resolves user-supplied globs (or plain file/directory paths) to a sorted, de-duplicated list of analysable source files, relative to `cwd` with forward slashes.
 * `node_modules` is always excluded.
 */
export async function discoverFiles(patterns: readonly string[], cwd: string): Promise<string[]> {
  // Globs only understand forward slashes; on Windows users naturally type backslashes.
  const normalised =
    process.platform === 'win32' ? patterns.map((pattern) => pattern.replaceAll('\\', '/')) : [...patterns];

  const files = await glob(normalised, {
    cwd,
    ignore: ['**/node_modules/**'],
    onlyFiles: true,
    expandDirectories: true,
  });

  return files
    .filter((file) => SUPPORTED_EXTENSION.test(file) && !DECLARATION_FILE.test(file))
    .sort();
}
