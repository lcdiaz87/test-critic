import { RULES } from '../rules/index.js';
import type { Rule, RuleContext } from '../rules/rule.js';
import type { Finding } from '../types.js';
import { collectAssertionSites, type AssertionSite } from './assertions.js';
import { parseSources, type ParseFailure, type SourceInput } from './parse.js';
import { collectTests, type TestCase } from './test-inventory.js';

export interface FileAnalysis {
  file: string;
  /** Test declarations found in the file (commented-out tests are not code and are not counted). */
  testCount: number;
  /** Tests that are skipped or have at least one finding that alone proves they cannot fail. */
  cannotFailCount: number;
  findings: Finding[];
}

export interface AnalysisResult {
  files: FileAnalysis[];
  /** Files skipped because they do not parse; reported separately, never as findings. */
  parseFailures: ParseFailure[];
}

export function analyzeSources(inputs: readonly SourceInput[], rules: readonly Rule[] = RULES): AnalysisResult {
  const files: FileAnalysis[] = [];
  const parseFailures: ParseFailure[] = [];

  for (const parsed of parseSources(inputs)) {
    if (!parsed.ok) {
      parseFailures.push({ file: parsed.file, line: parsed.line, message: parsed.message });
      continue;
    }

    const { file, sourceFile } = parsed;
    const inventory = collectTests(sourceFile);
    const sitesCache = new Map<TestCase, readonly AssertionSite[]>();
    const context: RuleContext = {
      sourceFile,
      inventory,
      assertionSites: (test) => {
        let sites = sitesCache.get(test);
        if (sites === undefined) {
          sites = test.callback === undefined ? [] : collectAssertionSites(test.callback, test.parameterized);
          sitesCache.set(test, sites);
        }
        return sites;
      },
    };

    const unableToFail = new Set(inventory.tests.filter((test) => test.skipped));
    const findings: Finding[] = [];
    for (const rule of rules) {
      for (const hit of rule.check(context)) {
        if (hit.makesTestUnableToFail && hit.test !== undefined) unableToFail.add(hit.test);
        const { line, column } = sourceFile.getLineAndColumnAtPos(hit.pos);
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          file,
          line,
          column,
          testName: hit.title !== undefined ? hit.title : (hit.test?.title ?? null),
          message: hit.message,
        });
      }
    }

    files.push({
      file,
      testCount: inventory.tests.length,
      cannotFailCount: unableToFail.size,
      findings: findings.sort(compareFindings),
    });
  }

  return { files, parseFailures };
}

export function compareFindings(a: Finding, b: Finding): number {
  return a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId);
}
