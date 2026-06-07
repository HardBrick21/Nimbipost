import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGuestSession, X_PUBLIC_BEARER_TOKEN } from '../../src/platforms/x/session';
import type { TransportRequest } from '../../src/platforms/x/request-client';

const key =
  'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8w';
const rows = [
  'M 0 0 C 10 20 30 40 50 60 70 80 90 100 110',
  'M 0 0 C 11 21 31 41 51 61 71 81 91 101 111',
  'M 0 0 C 12 22 32 42 52 62 72 82 92 102 112',
  'M 0 0 C 13 23 33 43 53 63 73 83 93 103 113',
  'M 0 0 C 14 24 34 44 54 64 74 84 94 104 114',
];
const frames = Array.from({ length: 4 }, (_, index) => {
  const path =
    index === 2 ? rows.join('') : 'M 0 0 C 1 2 3 4 5 6 7 8 9 10 11';

  return `<svg id="loading-x-anim-${index}"><g><path d="${path}"></path></g></svg>`;
});
const homePageHtml = `<html><head><meta name="twitter-site-verification" content="${key}"></head><body>${frames.join('')}<script>var chunks={0:"x",123:"ondemand.s",123:"abcdef"};</script></body></html>`;
const ondemandFileJs =
  'function f(){ return (a[2], 16) + (a[12], 16) + (a[14], 16) + (a[7], 16); }';

describe('createGuestSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the public bearer token when activating a guest token', async () => {
    const requests: TransportRequest[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(ondemandFileJs, { status: 200 })),
    );

    await createGuestSession({
      transport: async (request) => {
        requests.push(request);

        if (request.url === 'https://x.com' || request.url === 'https://x.com/') {
          return {
            status: 200,
            headers: { 'content-type': 'text/html' },
            body: homePageHtml,
          };
        }

        if (request.url === 'https://api.x.com/1.1/guest/activate.json') {
          return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ guest_token: 'guest-123' }),
          };
        }

        throw new Error(`Unexpected request: ${request.url}`);
      },
    });

    const guestRequest = requests.find((request) =>
      request.url.endsWith('/guest/activate.json'),
    );
    const homeRequest = requests.find((request) => request.url === 'https://x.com');
    expect(homeRequest?.headers.Authorization).toBeUndefined();
    expect(X_PUBLIC_BEARER_TOKEN).toMatch(/^Bearer /);
    expect(guestRequest?.headers.Authorization).toBe(X_PUBLIC_BEARER_TOKEN);
  });

  it('bootstraps ct0 csrf cookie and header when authToken is provided', async () => {
    const requests: TransportRequest[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(ondemandFileJs, { status: 200 })),
    );

    const session = await createGuestSession({
      authToken: 'auth-token',
      transport: async (request) => {
        requests.push(request);

        if (request.url === 'https://x.com' || request.url === 'https://x.com/') {
          const hasAuthCookie = request.headers.Cookie?.includes(
            'auth_token=auth-token',
          );

          return {
            status: 200,
            headers: {
              'content-type': 'text/html',
              ...(hasAuthCookie
                ? {
                    'set-cookie':
                      'ct0=csrf-token; Path=/; Domain=x.com; Secure; SameSite=Lax, twid=u%3D123; Path=/; Domain=.x.com; Secure',
                  }
                : {}),
            },
            body: homePageHtml,
          };
        }

        if (request.url === 'https://api.x.com/1.1/guest/activate.json') {
          return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ guest_token: 'guest-123' }),
          };
        }

        throw new Error(`Unexpected request: ${request.url}`);
      },
    });

    const authenticatedHomeRequest = requests.find((request) =>
      request.headers.Cookie?.includes('auth_token=auth-token'),
    );
    expect(authenticatedHomeRequest?.url).toBe('https://x.com/');
    expect(authenticatedHomeRequest?.headers.Authorization).toBeUndefined();
    expect(authenticatedHomeRequest?.headers['X-Guest-Token']).toBeUndefined();
    expect(session.snapshot.cookies).toMatchObject({
      auth_token: 'auth-token',
      ct0: 'csrf-token',
      twid: 'u%3D123',
    });
    expect(session.snapshot.headers).toMatchObject({
      'X-Csrf-Token': 'csrf-token',
      'X-Twitter-Auth-Type': 'OAuth2Session',
    });
  });
});
