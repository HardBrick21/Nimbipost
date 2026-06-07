import { vi } from 'vitest';
import {
  handleGatewayRequest,
  initializeGatewayOptions,
  type GatewayAdapterFactory,
  type GatewayServerOptions,
} from '../../src/gateway/server';
import type { PlatformAdapter, PlatformName } from '../../src/core/platform-adapter';

describe('gateway server', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let factory: GatewayAdapterFactory;

  beforeEach(() => {
    calls.length = 0;
    factory = (platform, options) => {
      calls.push({ method: 'factory', args: [platform, options] });
      return fakeAdapter(platform);
    };
  });

  it('returns health status', async () => {
    const response = await get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('initializes and updates the X adapter for gateway startup', async () => {
    const options = await initializeGatewayOptions({ adapterFactory: factory });

    expect(calls).toContainEqual({ method: 'factory', args: ['x', undefined] });
    expect(calls).toContainEqual({ method: 'init', args: [] });
    expect(calls).toContainEqual({ method: 'updateApi', args: [] });

    calls.length = 0;
    const first = await get('/v1/x/users/elonmusk', options);
    const second = await get('/v1/x/users/jack', options);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(calls.filter((call) => call.method === 'factory')).toHaveLength(0);
    expect(calls).toContainEqual({
      method: 'getUserData',
      args: ['elonmusk'],
    });
    expect(calls).toContainEqual({
      method: 'getUserData',
      args: ['jack'],
    });
  });

  it('keeps gateway startup available when the X API update fails', async () => {
    const stderrWrite = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const options = await initializeGatewayOptions({
      adapterFactory(platform) {
        calls.push({ method: 'factory', args: [platform, undefined] });
        return fakeAdapter(platform, { updateApiError: new Error('update failed') });
      },
    });

    const response = await get('/v1/x/users/elonmusk', options);

    expect(response.status).toBe(200);
    expect(calls).toContainEqual({ method: 'updateApi', args: [] });
    expect(stderrWrite).toHaveBeenCalledWith(
      'Nimbipost gateway could not update X API endpoints: update failed\n',
    );
    stderrWrite.mockRestore();
  });

  it('returns user data for a platform username', async () => {
    const response = await get('/v1/x/users/elonmusk');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      platform: 'x',
      data: { username: 'elonmusk', id: 'user-elonmusk' },
    });
    expect(calls).toContainEqual({
      method: 'getUserData',
      args: ['elonmusk'],
    });
  });

  it('resolves a username then returns user posts', async () => {
    const response = await get('/v1/x/users/elonmusk/posts?total=20');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      platform: 'x',
      data: [{ id: 'post-user-elonmusk' }],
      cursor_endpoint: null,
      has_next_page: false,
    });
    expect(calls).toContainEqual({
      method: 'getUserId',
      args: ['elonmusk'],
    });
    expect(calls).toContainEqual({
      method: 'getUserPosts',
      args: ['user-elonmusk', { total: 20 }],
    });
  });

  it('returns a post by id', async () => {
    const response = await get('/v1/x/posts/123');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      platform: 'x',
      data: { id: '123', text: 'post 123' },
    });
    expect(calls).toContainEqual({ method: 'getPost', args: ['123'] });
  });

  it('searches posts by query', async () => {
    const response = await get('/v1/x/search?q=BTC&total=5');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      platform: 'x',
      data: [{ id: 'search-BTC' }],
      cursor_endpoint: null,
      has_next_page: false,
    });
    expect(calls).toContainEqual({
      method: 'search',
      args: ['BTC', { total: 5 }],
    });
  });

  it('returns following users for a platform username', async () => {
    const response = await get(
      '/v1/x/users/barton6026/friends?following=true&pagination=false',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      platform: 'x',
      data: [
        {
          content: {
            itemContent: {
              user_results: {
                result: {
                  legacy: {
                    screen_name: 'alice',
                  },
                },
              },
            },
          },
        },
      ],
      cursor_endpoint: 'next-cursor',
      has_next_page: true,
    });
    expect(calls).toContainEqual({
      method: 'getUserId',
      args: ['barton6026'],
    });
    expect(calls).toContainEqual({
      method: 'getFriends',
      args: ['user-barton6026', { following: true, pagination: false }],
    });
  });

  it('passes friends cursors and totals through to the adapter', async () => {
    const response = await get(
      '/v1/x/users/barton6026/friends?following=true&cursor=abc123&total=10',
    );

    expect(response.status).toBe(200);
    expect(calls).toContainEqual({
      method: 'getFriends',
      args: [
        'user-barton6026',
        { following: true, total: 10, endCursor: 'abc123' },
      ],
    });
  });

  it('requires exactly one friends mode', async () => {
    const response = await get('/v1/x/users/barton6026/friends');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Set exactly one friends timeline mode.',
    });
  });

  it('returns 400 when search query is missing', async () => {
    const response = await get('/v1/x/search');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Missing required query parameter: q' });
  });

  it('returns 404 for unknown routes', async () => {
    const response = await get('/v1/x/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Route not found' });
  });

  async function get(
    path: string,
    options: GatewayServerOptions = { adapterFactory: factory },
  ): Promise<{ status: number; body: unknown }> {
    const response = await handleGatewayRequest(
      { method: 'GET', url: path } as never,
      options,
    );

    return {
      status: response.status,
      body: response.body,
    };
  }

  function fakeAdapter(
    platform: PlatformName,
    options: { updateApiError?: Error } = {},
  ): PlatformAdapter {
    return {
      platform,
      async init() {
        calls.push({ method: 'init', args: [] });
      },
      async updateApi() {
        calls.push({ method: 'updateApi', args: [] });

        if (options.updateApiError) {
          throw options.updateApiError;
        }

        return { USER_DATA_ENDPOINT: 'new/UserByScreenName' };
      },
      async getUserId(username) {
        calls.push({ method: 'getUserId', args: [username] });
        return `user-${username}`;
      },
      async getUserData(username) {
        calls.push({ method: 'getUserData', args: [username] });
        return { username, id: `user-${username}` };
      },
      async getUserInfo(userId) {
        calls.push({ method: 'getUserInfo', args: [userId] });
        return { id: userId };
      },
      async getUserPosts(userId, options) {
        calls.push({ method: 'getUserPosts', args: [userId, options] });
        return {
          data: [{ id: `post-${userId}` }],
          cursor_endpoint: null,
          has_next_page: false,
        };
      },
      async getPost(postId) {
        calls.push({ method: 'getPost', args: [postId] });
        return { id: String(postId), text: `post ${postId}` };
      },
      async search(query, options) {
        calls.push({ method: 'search', args: [query, options] });
        return {
          data: [{ id: `search-${query}` }],
          cursor_endpoint: null,
          has_next_page: false,
        };
      },
      async getFriends(userId, options) {
        calls.push({ method: 'getFriends', args: [userId, options] });
        return {
          data: [
            {
              content: {
                itemContent: {
                  user_results: {
                    result: {
                      legacy: {
                        screen_name: 'alice',
                      },
                    },
                  },
                },
              },
            },
          ],
          cursor_endpoint: 'next-cursor',
          has_next_page: true,
        };
      },
    };
  }
});
