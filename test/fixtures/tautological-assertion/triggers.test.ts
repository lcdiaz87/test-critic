import { describe, expect, it } from 'vitest';
import { createStore, loadConfig, loadUser, sum } from './math';

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

  it('compares a property with itself', () => {
    const config = loadConfig();
    expect(config.port).toBe(config.port);
  });

  it('compares a nested property and an index with themselves', () => {
    const user = loadUser();
    expect(user.address.city).toEqual(user.address.city);
    expect(user.roles[0]).toBe(user.roles[0]);
  });

  it('reads a memoised getter twice', () => {
    const store = createStore();
    expect(store.state).toBe(store.state);
  });

  it('compares this.value with itself', function () {
    expect(this.value).toBe(this.value);
  });
});
