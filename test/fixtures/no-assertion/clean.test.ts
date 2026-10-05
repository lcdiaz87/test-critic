import assert from 'node:assert';
import sinon from 'sinon';
import { describe, expect, it } from 'vitest';
import { expectValidUser } from './helpers';
import { add, fetchUser, server } from './math';

function verifySum(a: number, b: number, total: number) {
  expect(add(a, b)).toBe(total);
}

const checkPositive = (n: number) => {
  if (n <= 0) throw new Error(`${n} is not positive`);
};

function runAdditionScenario() {
  expect(add(2, 2)).toBe(4);
}

describe('every way of asserting that must not be reported', () => {
  it('uses expect', () => {
    expect(add(1, 1)).toBe(2);
  });

  it('uses node assert', () => {
    assert.strictEqual(add(1, 1), 2);
  });

  it('uses a bare assert call', () => {
    assert(add(1, 1) === 2);
  });

  it('uses chai should', () => {
    add(1, 1).should.equal(2);
  });

  it('uses a chai property assertion', () => {
    expect(add(1, 1) === 2).to.be.true;
  });

  it('uses sinon.assert', () => {
    const spy = sinon.spy();
    add(1, 1);
    sinon.assert.notCalled(spy);
  });

  it('uses an imported helper that follows the expect* convention', async () => {
    expectValidUser(await fetchUser(1));
  });

  it('uses a local helper that asserts', () => {
    verifySum(1, 2, 3);
  });

  it('uses a local arrow helper that throws', () => {
    checkPositive(add(1, 1));
  });

  it('throws on a wrong result', () => {
    if (add(1, 1) !== 2) throw new Error('wrong sum');
  });

  it('asserts inside a callback', () => {
    [1, 2].forEach((n) => expect(add(n, 0)).toBe(n));
  });

  it('reports errors through done', (done) => {
    fetchUser(1).then(() => done(), (error) => done(error));
  });

  it('hands done to code that may pass it an error', (done) => {
    server.close(done);
  });

  it('uses done.fail', (done) => {
    fetchUser(1).catch(done.fail);
  });

  it('is declared by reference', runAdditionScenario);

  it.fails('is expected to fail, so no assertion is needed', () => {
    add(1, 1);
  });
});
