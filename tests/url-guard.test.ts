import { describe, expect, it } from 'vitest';
import { assertSafeUrl, isPrivateIp } from '../src/collectors/url-guard';

describe('isPrivateIp', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])('blocks %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });
  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])('allows %s', (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  it.each(['file:///etc/passwd', 'ftp://example.com', 'http://127.0.0.1', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'http://user:pw@example.com', 'not a url'])('rejects %s', async (u) => {
    await expect(assertSafeUrl(u)).rejects.toThrow();
  });
  it('allows private addresses only with the explicit test flag', async () => {
    await expect(assertSafeUrl('http://127.0.0.1:3000/', { allowPrivate: true })).resolves.toContain('127.0.0.1');
  });
});
