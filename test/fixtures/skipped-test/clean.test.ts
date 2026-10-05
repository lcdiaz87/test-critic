import { describe, expect, it } from 'vitest';
import { add, run } from './math';

describe('conditional skips that must not be reported', () => {
  it('runs normally', () => {
    expect(add(1, 1)).toBe(2);
  });

  it.skipIf(process.platform === 'win32')('is skipped only on Windows', () => {
    expect(run('ls')).toBeDefined();
  });

  it.runIf(process.env.CI)('runs only on CI', () => {
    expect(add(1, 1)).toBe(2);
  });
});
