import { noAssertion } from './no-assertion.js';
import type { Rule } from './rule.js';
import { skippedTest } from './skipped-test.js';
import { tautologicalAssertion } from './tautological-assertion.js';

export const RULES: readonly Rule[] = [noAssertion, tautologicalAssertion, skippedTest];
