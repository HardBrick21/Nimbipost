import { describe, expect, it } from 'vitest';
import { XAdapter } from '../../src/platforms/x/adapter';

function createAdapter(
  responses: Array<Record<string, unknown>>,
  options: { authToken?: string } = {},
) {
  const requests: Array<{ url: string; params?: Record<string, string> }> = [];
  const adapter = new XAdapter({
    autoInit: false,
    requestClient: {
      async request(url: string, options?: { params?: Record<string, string> }) {
        requests.push({ url, params: options?.params });
        const response = responses.shift();
        if (!response) {
          throw new Error('No fake response configured');
        }

        return response;
      },
      getSessionSnapshot: options.authToken
        ? () => ({ headers: {}, cookies: { auth_token: options.authToken ?? '' } })
        : undefined,
    },
  });

  return { adapter, requests };
}

describe('XAdapter', () => {
  it('builds TweeterPy-compatible UserByScreenName requests', async () => {
    const { adapter, requests } = createAdapter([
      { data: { user: { result: { rest_id: '44196397' } } } },
    ]);

    const result = await adapter.getUserData('elonmusk');

    expect(result).toEqual({ rest_id: '44196397' });
    expect(requests[0].url).toContain('/UserByScreenName');
    expect(JSON.parse(requests[0].params?.variables ?? '{}')).toEqual({
      screen_name: 'elonmusk',
      withSafetyModeUserFields: true,
    });
    expect(JSON.parse(requests[0].params?.features ?? '{}')).toMatchObject({
      responsive_web_graphql_timeline_navigation_enabled: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
    });
  });

  it('returns numeric usernames as user ids without a network request', async () => {
    const { adapter, requests } = createAdapter([]);

    await expect(adapter.getUserId('12345')).resolves.toBe('12345');
    expect(requests).toHaveLength(0);
  });

  it('loads viewer information through the Viewer endpoint', async () => {
    const { adapter, requests } = createAdapter([
      { data: { viewer: { user_results: { result: { rest_id: '1' } } } } },
    ]);

    const viewer = await adapter.getMe();

    expect(viewer).toEqual({
      data: { viewer: { user_results: { result: { rest_id: '1' } } } },
    });
    expect(requests[0].url).toContain('/Viewer');
    expect(JSON.parse(requests[0].params?.variables ?? '{}')).toEqual({
      withCommunitiesMemberships: true,
      withSubscribedTab: true,
      withCommunitiesCreation: true,
    });
  });

  it('extracts timeline entries and bottom cursor from paginated user tweets', async () => {
    const { adapter } = createAdapter([
      { data: { user: { result: { rest_id: '44196397' } } } },
      {
        data: {
          user: {
            result: {
              timeline: {
                timeline: {
                  instructions: [
                    {
                      type: 'TimelineAddEntries',
                      entries: [
                        { entryId: 'tweet-1', content: { itemContent: { id: '1' } } },
                        { entryId: 'cursor-bottom-1', content: { value: 'bottom' } },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]);

    const page = await adapter.getUserTweets('elonmusk', {
      pagination: false,
    });

    expect(page.data).toEqual([
      { entryId: 'tweet-1', content: { itemContent: { id: '1' } } },
    ]);
    expect(page.cursor_endpoint).toBe('bottom');
    expect(page.has_next_page).toBe(true);
  });

  it('uses the media timeline path for user media', async () => {
    const { adapter } = createAdapter([
      { data: { user: { result: { rest_id: '44196397' } } } },
      {
        data: {
          user: {
            result: {
              timeline_v2: {
                timeline: {
                  instructions: [
                    {
                      type: 'TimelineAddEntries',
                      entries: [
                        { entryId: 'tweet-media-1', content: { itemContent: { id: 'm1' } } },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]);

    const page = await adapter.getUserMedia('elonmusk', {
      pagination: false,
    });

    expect(page.data).toEqual([
      { entryId: 'tweet-media-1', content: { itemContent: { id: 'm1' } } },
    ]);
  });

  it('requires exactly one friends timeline mode', async () => {
    const { adapter } = createAdapter([]);

    await expect(adapter.getFriends('44196397')).rejects.toThrow(
      'Set exactly one friends timeline mode.',
    );
  });

  it('requires an authenticated session for friends timelines', async () => {
    const { adapter } = createAdapter([]);

    await expect(
      adapter.getFriends('44196397', { following: true }),
    ).rejects.toThrow('X auth token is required for friends timelines.');
  });

  it('uses the following timeline path for authenticated friends requests', async () => {
    const { adapter, requests } = createAdapter(
      [
        {
          data: {
            user: {
              result: {
                timeline: {
                  timeline: {
                    instructions: [
                      {
                        type: 'TimelineAddEntries',
                        entries: [
                          {
                            entryId: 'user-1',
                            content: { itemContent: { id: 'u1' } },
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      ],
      { authToken: 'auth-token' },
    );

    const page = await adapter.getFriends('44196397', {
      following: true,
      pagination: false,
    });

    expect(page.data).toEqual([
      { entryId: 'user-1', content: { itemContent: { id: 'u1' } } },
    ]);
    expect(requests[0].url).toContain('/Following');
  });

  it('uses the favoriters timeline path for tweet likes', async () => {
    const { adapter, requests } = createAdapter([
      {
        data: {
          favoriters_timeline: {
            timeline: {
              instructions: [
                {
                  type: 'TimelineAddEntries',
                  entries: [
                    { entryId: 'user-1', content: { itemContent: { id: 'u1' } } },
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    const page = await adapter.getTweetLikes('98765', { pagination: false });

    expect(page.data).toEqual([
      { entryId: 'user-1', content: { itemContent: { id: 'u1' } } },
    ]);
    expect(requests[0].url).toContain('/graphql/mpMee2WCjo7Nm4gRRHHnvA/Favoriters');
  });
});
