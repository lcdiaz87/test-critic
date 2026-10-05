import { describe, it, test } from 'vitest';
import { add, fetchUser } from './math';

describe('math', () => {
  it('adds numbers', () => {
    add(1, 2);
  });

  it('loads a user without crashing', async () => {
    await fetchUser(1);
  });

  test('has an empty body', () => {});

  it.each([1, 2, 3])('doubles %i', (n) => {
    add(n, n);
  });

  it('only signals completion through done', (done) => {
    add(1, 1);
    done();
  });
});
