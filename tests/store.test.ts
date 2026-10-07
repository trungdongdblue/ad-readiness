import { describe, expect, it } from 'vitest';
import { memoryStore, redisStore, type Store } from '../src/app/store';

/** Same contract for both stores. The Redis run needs REDIS_TEST_URL (use a spare db, e.g. redis://127.0.0.1:6379/15); it is skipped otherwise. */
const redisUrl = process.env['REDIS_TEST_URL'];
const make: [string, () => Store][] = [['memory', memoryStore], ...(redisUrl ? ([['redis', () => redisStore(redisUrl)]] as [string, () => Store][]) : [])];

describe.each(make)('%s store', (_name, build) => {
  const store = build();
  const key = `t${Date.now()}`;

  it('round-trips a job and returns undefined for an unknown id', async () => {
    await store.save({ id: key, status: 'running', stage: 'checkout' }, 60);
    expect(await store.load(key)).toEqual({ id: key, status: 'running', stage: 'checkout' });
    expect(await store.load('nope')).toBeUndefined();
  });

  it('counts hits inside a window', async () => {
    expect(await store.hit(key, 60)).toBe(1);
    expect(await store.hit(key, 60)).toBe(2);
  });
});
