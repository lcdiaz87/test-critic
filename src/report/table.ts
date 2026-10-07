import type { Finding } from '../types.js';

export interface Summary {
  tests: number;
  placebos: number;
  findings: number;
  rules: number;
}

/**
 * `120 tests analysed · 34 placebo (28%) · 51 findings across 6 rules`
 * This line is the project's headline, so its shape is part of the CLI contract.
 */
export function formatSummary(summary: Summary): string {
  const percent = summary.tests === 0 ? 0 : Math.round((summary.placebos / summary.tests) * 100);
  return [
    `${plural(summary.tests, 'test')} analysed`,
    `${String(summary.placebos)} placebo (${String(percent)}%)`,
    `${plural(summary.findings, 'finding')} across ${plural(summary.rules, 'rule')}`,
  ].join(' · ');
}

/**
 * Human-readable report, grouped by file:
 *
 *   test/math.test.ts
 *     5:3  error  no-assertion  math › adds numbers
 *          This test has no assertion, so it passes whatever the code under test does.
 */
export function formatTable(findings: readonly Finding[]): string {
  const byFile = new Map<string, Finding[]>();
  for (const finding of findings) {
    const group = byFile.get(finding.file) ?? [];
    group.push(finding);
    byFile.set(finding.file, group);
  }

  const blocks: string[] = [];
  for (const [file, group] of byFile) {
    const rows = group.map((finding) => ({
      location: `${String(finding.line)}:${String(finding.column)}`,
      severity: finding.severity,
      rule: finding.ruleId,
      test: finding.testName ?? '(file)',
      message: finding.message,
    }));
    const width = {
      location: Math.max(...rows.map((row) => row.location.length)),
      severity: Math.max(...rows.map((row) => row.severity.length)),
      rule: Math.max(...rows.map((row) => row.rule.length)),
    };
    const lines = [file];
    for (const row of rows) {
      lines.push(
        `  ${row.location.padEnd(width.location)}  ${row.severity.padEnd(width.severity)}  ${row.rule.padEnd(width.rule)}  ${row.test}`,
        `  ${' '.repeat(width.location)}  ${row.message}`,
      );
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
