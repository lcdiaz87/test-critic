import { describe, expect, it } from 'vitest';
import { add, run } from './math';

/**
 * Example of how the helpers are used in a test:
 * it('adds', () => {
 *   expect(add(1, 1)).toBe(2);
 * });
 */
describe('comments and conditional skips that must not be reported', () => {
  // TODO: test('large inputs') once the fixture exists
  // Usage: it('name', () => {})
  // const unused = add(1, 1);
  // expect(add(1, 2)).toBe(3);
  it('runs normally', () => {
    expect(add(1, 1)).toBe(2); // it('is an inline annotation', () => {})
  });

  it.skipIf(process.platform === 'win32')('is skipped only on Windows', () => {
    expect(run('ls')).toBeDefined();
  });

  it.runIf(process.env.CI)('runs only on CI', () => {
    expect(add(1, 1)).toBe(2);
  });
});
