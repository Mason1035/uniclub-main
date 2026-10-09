import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomMemberIndex } from '../src/lib/randomCall';

function samples(values: number[]) {
  let calls = 0;
  return {
    source: { getRandomValues(array: Uint32Array) { array[0] = values[calls++]; return array; } } as Pick<Crypto, 'getRandomValues'>,
    count: () => calls,
  };
}

test('rejects empty, fractional and oversized pools', () => {
  for (const length of [0, -1, 1.5, NaN, Infinity, 2 ** 32 + 1]) {
    assert.throws(() => randomMemberIndex(length), RangeError);
  }
});

test('rejection sampling skips the biased upper remainder', () => {
  const random = samples([2 ** 32 - 1, 2 ** 32 - 2, 48]);
  assert.equal(randomMemberIndex(49, random.source), 48);
  assert.equal(random.count(), 3);
});

test('all members, including the first and last, are reachable', () => {
  const random = samples(Array.from({ length: 49 }, (_, index) => index));
  assert.deepEqual(Array.from({ length: 49 }, () => randomMemberIndex(49, random.source)), Array.from({ length: 49 }, (_, index) => index));
});

test('single-member pools and repeated draws remain valid', () => {
  const random = samples([100, 12, 12]);
  assert.equal(randomMemberIndex(1, random.source), 0);
  assert.equal(randomMemberIndex(49, random.source), 12);
  assert.equal(randomMemberIndex(49, random.source), 12);
});
