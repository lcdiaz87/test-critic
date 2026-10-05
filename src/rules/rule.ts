import type { SourceFile } from 'ts-morph';
import type { AssertionSite } from '../engine/assertions.js';
import type { TestCase, TestInventory } from '../engine/test-inventory.js';
import type { RuleId, Severity } from '../types.js';

export interface RuleContext {
  sourceFile: SourceFile;
  inventory: TestInventory;
  /** Assertion sites of a test, computed once and shared by every rule. Empty when the callback cannot be resolved. */
  assertionSites: (test: TestCase) => readonly AssertionSite[];
}

/**
 * What a rule reports. The engine turns hits into public findings (file, line, column).
 * Rules never compute positions or decide the final shape of a finding; they only say what is wrong and where.
 */
export interface RuleHit {
  /** Offset in the file where the finding points. */
  pos: number;
  /** The test this hit belongs to, when there is one. */
  test?: TestCase;
  /** Title shown in the report; defaults to the test title, null for file-level hits. */
  title?: string | null;
  message: string;
  /**
   * True when this hit alone proves the test cannot fail.
   * A tautological assertion next to a real one is still worth reporting, but the test can fail, so it does not count towards the summary percentage.
   */
  makesTestUnableToFail: boolean;
}

export interface Rule {
  id: RuleId;
  severity: Severity;
  check: (context: RuleContext) => RuleHit[];
}

/** Tests whose body actually runs and can be judged on its assertions. */
export function runnableTests(context: RuleContext): TestCase[] {
  // Skipped tests are reported by skipped-test; judging the assertions of code that never runs would only add noise.
  // Tests expected to fail (`it.fails`) pass by throwing, so their assertions follow different logic and are left alone.
  return context.inventory.tests.filter((test) => !test.skipped && !test.expectsFailure && test.callback !== undefined);
}
