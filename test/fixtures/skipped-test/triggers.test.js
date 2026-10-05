const { add } = require('./math');

xdescribe('legacy suite', () => {
  it('adds', () => {
    expect(add(1, 1)).toBe(2);
  });
});

xit('is skipped with xit', () => {
  expect(add(1, 1)).toBe(2);
});
