import {
  handleGatewayRequest,
  type GatewayAdapterFactory,
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

  async function get(path: string): Promise<{ status: number; body: unknown }> {
    const response = await handleGatewayRequest(
      { method: 'GET', url: path } as never,
      { adapterFactory: factory },
    );

    return {
      status: response.status,
      body: response.body,
    };
  }

  function fakeAdapter(platform: PlatformName): PlatformAdapter {
    return {
      platform,
      async init() {
        calls.push({ method: 'init', args: [] });
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
    };
  }
});
