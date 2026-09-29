/** Ordered from least to most severe; the index is used for threshold comparisons. */
export const SEVERITIES = ['warning', 'error'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const RULE_IDS = [
  'no-assertion',
  'tautological-assertion',
  'conditional-assertion',
  'missing-await',
  'swallowed-error',
  'fragile-selector',
  'skipped-test',
  'happy-path-only',
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export interface Finding {
  ruleId: RuleId;
  severity: Severity;
  /** Path relative to the working directory, always with forward slashes. */
  file: string;
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
  /** Full test title including enclosing describe blocks; null for file-level findings. */
  testName: string | null;
  /** One sentence explaining why this finding matters. */
  message: string;
}

export function isAtLeast(severity: Severity, threshold: Severity): boolean {
  return SEVERITIES.indexOf(severity) >= SEVERITIES.indexOf(threshold);
}
