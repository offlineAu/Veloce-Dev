import { afterEach, describe, expect, it, vi } from 'vitest';
import { calEndpoints } from '@/lib/cal-endpoints';

afterEach(() => vi.unstubAllEnvs());
describe('Cal endpoint isolation', () => {
  it('keeps hosted credentials on the hosted API', () => {
    expect(calEndpoints(false).apiBase).toBe('https://api.cal.com/v2/');
    expect(() => calEndpoints(false, 'https://cal.com/veloce/intro', 'https://evil.example/v2/')).toThrow();
    expect(() => calEndpoints(false, 'http://localhost:3002/veloce/intro')).toThrow();
  });
  it('allows explicit development loopback endpoints', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(calEndpoints(true, 'http://localhost:3002/veloce/intro', 'http://127.0.0.1:5555/v2/')).toMatchObject({
      webOrigin: 'http://localhost:3002', apiBase: 'http://127.0.0.1:5555/v2/', embedUrl: 'http://localhost:3002/embed/embed.js',
    });
  });
  it('rejects local mode in production and non-loopback substitutions', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => calEndpoints(true, 'http://localhost:3002/veloce/intro')).toThrow('development');
    vi.stubEnv('NODE_ENV', 'development');
    for (const api of ['http://evil.example/v2/', 'http://localhost:5555/v2/?key=anything', 'http://user:password@localhost:5555/v2/']) {
      expect(() => calEndpoints(true, 'http://localhost:3002/veloce/intro', api)).toThrow();
    }
  });
});
