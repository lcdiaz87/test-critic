import { describe, expect, it } from 'vitest';
import { sum } from './math';

describe('tautologies', () => {
  it('compares two literals', () => {
    expect(true).toBe(true);
  });

  it('compares a variable with itself', () => {
    const total = sum([1, 2]);
    expect(total).toEqual(total);
  });

  it('checks that a literal is truthy', () => {
    sum([]);
    expect(1).toBeTruthy();
  });

  it('uses a soft assertion on a literal', () => {
    expect.soft(null).toBeNull();
  });

  it('hides a tautology next to a real assertion', () => {
    expect(sum([1, 2])).toBe(3);
    expect('ok').toStrictEqual('ok');
  });
});
