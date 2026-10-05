import { describe, expect, it } from 'vitest';
import { createStore, sum } from './math';

describe('assertions that look similar but can fail', () => {
  it('compares a result with a literal', () => {
    expect(sum([1, 2])).toBe(3);
  });

  it('compares two different variables', () => {
    const first = sum([1]);
    const second = sum([1]);
    expect(first).toEqual(second);
  });

  it('checks a memoised getter returns the same instance', () => {
    const store = createStore();
    expect(store.state).toBe(store.state);
  });

  it('compares zero with negative zero', () => {
    expect(0).toBe(-0);
  });

  it('compares a number with a string', () => {
    expect(1).toBe('1');
  });

  it('negates a self comparison, which always fails instead of always passing', () => {
    const total = sum([1]);
    expect(total).not.toBe(total);
  });

  it('checks a falsy literal for truthiness, which always fails', () => {
    expect(0).toBeTruthy();
  });
});
