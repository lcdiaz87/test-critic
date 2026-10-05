import { describe, expect, it } from 'vitest';
import { analyzeSources } from '../../src/engine/analyze.js';

describe('analyzeSources', () => {
  it('skips files with syntax errors instead of guessing, and reports where they broke', () => {
    const result = analyzeSources([
      { file: 'broken.test.ts', text: "it('a', () => {\n  add(1,\n});\n" },
      { file: 'ok.test.ts', text: "it('b', () => { expect(1 + 1).toBe(2); });\n" },
    ]);
    expect(result.parseFailures).toEqual([{ file: 'broken.test.ts', line: 3, message: expect.any(String) as string }]);
    expect(result.files.map((file) => file.file)).toEqual(['ok.test.ts']);
  });

  it('parses JSX in .tsx and .jsx files', () => {
    const result = analyzeSources([
      { file: 'button.test.tsx', text: "it('renders', () => { render(<Button />); });\n" },
      { file: 'link.test.jsx', text: "it('renders', () => { expect(render(<a href=\"/\">home</a>)).toBeTruthy(); });\n" },
    ]);
    expect(result.parseFailures).toEqual([]);
    expect(result.files.map((file) => file.findings.map((finding) => finding.ruleId))).toEqual([['no-assertion'], []]);
  });

  it('sorts findings by position and reports 1-based lines and columns', () => {
    const [file] = analyzeSources([
      { file: 'a.test.ts', text: "it('second', () => {});\nit.skip('first', () => {});\n" },
    ]).files;
    expect(file?.findings.map(({ line, column, ruleId }) => ({ line, column, ruleId }))).toEqual([
      { line: 1, column: 1, ruleId: 'no-assertion' },
      { line: 2, column: 1, ruleId: 'skipped-test' },
    ]);
  });
});
