import { describe, expect, it, test } from 'vitest';
import { add } from './math';

describe('skips', () => {
  it.skip('is skipped with it.skip', () => {
    expect(add(1, 1)).toBe(2);
  });

  test.skip('is skipped with test.skip', () => {
    expect(add(1, 1)).toBe(2);
  });

  it.todo('is a placeholder');

  it('still runs', () => {
    expect(add(1, 1)).toBe(2);
  });

  // it('is commented out', () => {
  //   expect(add(1, 2)).toBe(3);
  // });
});

describe.skip('a skipped suite', () => {
  it('never runs', () => {
    expect(add(2, 2)).toBe(4);
  });

  it('never runs either', () => {
    expect(add(3, 3)).toBe(6);
  });
});

// Disabled until the rounding bug is fixed:
// it('rounds halves up', () => {
//   expect(add(0.5, 0)).toBe(1);
// });

/* test('is block-commented', () => {
  expect(add(1, 1)).toBe(2);
}); */
