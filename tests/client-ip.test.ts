import { describe, expect, it } from 'vitest';
import { clientIp } from '../src/app/client-ip';

describe('clientIp', () => {
  it('ignores X-Forwarded-For when no proxy is trusted (a client could forge it)', () => {
    expect(clientIp('9.9.9.9', '1.1.1.1', 0)).toBe('9.9.9.9');
  });
  it('takes the entry our own proxy appended, not the forged left side', () => {
    expect(clientIp('10.0.0.2', '6.6.6.6, 203.0.113.7', 1)).toBe('203.0.113.7');
    expect(clientIp('10.0.0.2', ['6.6.6.6', '203.0.113.7, 10.0.0.9'], 2)).toBe('203.0.113.7');
  });
  it('falls back to the socket when the header is missing or shorter than the trusted chain', () => {
    expect(clientIp('10.0.0.2', undefined, 1)).toBe('10.0.0.2');
    expect(clientIp('10.0.0.2', '203.0.113.7', 2)).toBe('10.0.0.2');
    expect(clientIp(undefined, undefined, 0)).toBe('unknown');
  });
});
