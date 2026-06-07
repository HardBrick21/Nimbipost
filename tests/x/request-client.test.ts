import { afterEach, describe, expect, it, vi } from 'vitest';
import { XRequestClient } from '../../src/platforms/x/request-client';

describe('XRequestClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects an x-client-transaction-id generated from method and pathname', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    const client = new XRequestClient({
      transaction: {
        generateTransactionId(method: string, path: string) {
          calls.push({ method, path });
          return 'txid-123';
        },
      },
      transport: async (request) => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true }),
        request,
      }),
    });

    const response = await client.request('https://api.x.com/graphql/abc/User', {
      method: 'POST',
      headers: { Existing: 'yes' },
    });

    expect(calls).toEqual([{ method: 'POST', path: '/graphql/abc/User' }]);
    expect(response).toEqual({ ok: true });
    expect(client.lastRequest?.headers).toMatchObject({
      Existing: 'yes',
      'X-Client-Transaction-Id': 'txid-123',
    });
  });

  it('adds rate-limit metadata to JSON object responses', async () => {
    const client = new XRequestClient({
      transport: async () => ({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-rate-limit-limit': '100',
          'x-rate-limit-remaining': '0',
          'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 60),
        },
        body: JSON.stringify({ data: { ok: true } }),
      }),
    });

    const response = await client.request('https://api.x.com/graphql/abc/User');

    expect(response.api_rate_limit).toMatchObject({
      total_limit: 100,
      remaining_requests_count: 0,
      rate_limit_exhausted: true,
    });
  });

  it('removes inherited headers when a request override is undefined', async () => {
    const client = new XRequestClient({
      baseHeaders: {
        Authorization: 'Bearer token',
        'X-Guest-Token': 'guest-token',
      },
      transport: async (request) => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true }),
        request,
      }),
    });

    await client.request('https://x.com/', {
      headers: {
        Authorization: undefined,
        'X-Guest-Token': undefined,
      },
    });

    expect(client.lastRequest?.headers).not.toHaveProperty('Authorization');
    expect(client.lastRequest?.headers).not.toHaveProperty('X-Guest-Token');
  });

  it('throws when a GraphQL response only contains errors', async () => {
    const client = new XRequestClient({
      transport: async () => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ errors: [{ code: 88, message: 'Rate limit' }] }),
      }),
    });

    await expect(client.request('https://api.x.com/graphql/abc/User')).rejects.toThrow(
      'Error code 88 - Rate limit',
    );
  });

  it('preserves set-cookie headers from the default fetch transport', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{}', {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'set-cookie': 'ct0=csrf-token; Path=/; Secure',
            },
          }),
      ),
    );
    const client = new XRequestClient();

    await client.request('https://x.com/', { skipErrorChecking: true });

    expect(client.lastResponse?.headers['set-cookie']).toBe(
      'ct0=csrf-token; Path=/; Secure',
    );
  });
});
