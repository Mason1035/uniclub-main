/** Rejection sampling avoids modulo bias, including pools containing admins. */
export function randomMemberIndex(length: number, source: Pick<Crypto, 'getRandomValues'> = globalThis.crypto): number {
  const range = 2 ** 32;
  if (!Number.isSafeInteger(length) || length < 1 || length > range) {
    throw new RangeError('随机名单必须包含有效成员');
  }
  const limit = range - (range % length);
  const sample = new Uint32Array(1);
  do { source.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % length;
}
