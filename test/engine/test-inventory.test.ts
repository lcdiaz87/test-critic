import { describe, expect, it } from 'vitest';
import { parseSources } from '../../src/engine/parse.js';
import { collectTests } from '../../src/engine/test-inventory.js';

function inventoryOf(code: string, file = 'example.test.ts') {
  const [parsed] = parseSources([{ file, text: code }]);
  if (parsed?.ok !== true) throw new Error('example did not parse');
  const { tests, suites } = collectTests(parsed.sourceFile);
  return {
    tests: tests.map((test) => ({ title: test.title, skipped: test.skipped })),
    suites: suites.map((suite) => suite.title),
  };
}

describe('collectTests', () => {
  it('builds full titles from nested suites', () => {
    const { tests, suites } = inventoryOf(`
      describe('cart', () => {
        describe('totals', () => {
          it('sums items', () => {});
        });
        test('starts empty', () => {});
      });
    `);
    expect(suites).toEqual(['cart', 'cart › totals']);
    expect(tests.map((test) => test.title)).toEqual(['cart › totals › sums items', 'cart › starts empty']);
  });

  it('registers one test per each/for/skipIf declaration, not one per curried call', () => {
    const { tests } = inventoryOf(`
      it.each([1, 2])('handles %i', (n) => {});
      test.each\`a | b\`('table $a', ({ a }) => {});
      test.for([1])('for %i', ([n]) => {});
      it.skipIf(process.env.CI)('local only', () => {});
      it.skipIf(false).each([1])('chained %i', (n) => {});
    `);
    expect(tests.map((test) => test.title)).toEqual(['handles %i', 'table $a', 'for %i', 'local only', 'chained %i']);
  });

  it('understands Playwright suites and ignores hooks, steps and configuration', () => {
    const { tests, suites } = inventoryOf(`
      test.describe.serial('checkout', () => {
        test.use({ locale: 'es-ES' });
        test.beforeEach(async ({ page }) => {});
        test('pays', { tag: '@smoke' }, async ({ page }) => {
          await test.step('fill card', async () => {});
        });
      });
      test.describe.configure({ mode: 'parallel' });
    `, 'checkout.spec.ts');
    expect(suites).toEqual(['checkout']);
    expect(tests.map((test) => test.title)).toEqual(['checkout › pays']);
  });

  it('marks tests inside a skipped suite as skipped', () => {
    const { tests } = inventoryOf(`
      describe.skip('outer', () => {
        describe('inner', () => {
          it('deep', () => {});
        });
      });
      it('free', () => {});
    `);
    expect(tests).toEqual([
      { title: 'outer › inner › deep', skipped: true },
      { title: 'free', skipped: false },
    ]);
  });

  it('counts it.todo without a callback, but not a bare it() or a runtime test.skip()', () => {
    const { tests } = inventoryOf(`
      it.todo('later');
      it('pending without body');
      test('real', async ({ browserName }) => {
        test.skip(browserName === 'webkit', 'not supported');
      });
    `);
    expect(tests.map((test) => test.title)).toEqual(['later', 'real']);
  });

  it('accepts runners bound by require(), but not runners defined in the file', () => {
    expect(inventoryOf(`const { test } = require('@playwright/test'); test('a', () => {});`).tests).toHaveLength(1);
    expect(inventoryOf(`function test(name, fn) { fn(); } test('a', () => {});`).tests).toHaveLength(0);
    expect(inventoryOf(`const test = base.extend({}); test('a', () => {});`).tests).toHaveLength(0);
  });

  it('keeps titles that are not plain strings as written in the source', () => {
    const { tests } = inventoryOf('it(`adds ${a} and ${b}`, () => {}); describe(Cart, () => { it(\'x\', () => {}); });');
    expect(tests.map((test) => test.title)).toEqual(['adds ${a} and ${b}', 'Cart › x']);
  });
});
