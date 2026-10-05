import { readFileSync } from 'node:fs';
import { analyzeSources, type FileAnalysis } from '../../src/engine/analyze.js';
import type { RuleId } from '../../src/types.js';

const ROOT = new URL('../../', import.meta.url);

/** Analyses one fixture from test/fixtures, failing loudly if it does not parse (a broken fixture would make every assertion vacuous). */
export function analyzeFixture(path: string): FileAnalysis {
  const file = `test/fixtures/${path}`;
  const text = readFileSync(new URL(file, ROOT), 'utf8');
  const result = analyzeSources([{ file, text }]);
  const [analysis] = result.files;
  if (analysis === undefined) throw new Error(`Fixture ${file} did not parse: ${JSON.stringify(result.parseFailures)}`);
  return analysis;
}

/** The findings of one rule in a fixture, reduced to what the tests pin down: where, and for which test. */
export function findingsOf(path: string, ruleId: RuleId): { line: number; column: number; testName: string | null }[] {
  return analyzeFixture(path)
    .findings.filter((finding) => finding.ruleId === ruleId)
    .map(({ line, column, testName }) => ({ line, column, testName }));
}
