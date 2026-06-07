import { describe, expect, it } from 'vitest';
import {
  BlueskyAdapter,
  InstagramAdapter,
  MastodonAdapter,
  RedditAdapter,
  TelegramAdapter,
  ThreadsAdapter,
  TikTokAdapter,
  YouTubeAdapter,
  createPlatformAdapter,
} from '../../src/index';
import type { GenericTransportRequest } from '../../src/platforms/common/http-adapter';

function createRecorder(responses: unknown[]) {
  const requests: GenericTransportRequest[] = [];
  return {
    requests,
    transport: async (request: GenericTransportRequest) => {
      requests.push(request);
      const response = responses.shift();
      if (response === undefined) {
        throw new Error('No fake response configured');
      }
      return response;
    },
  };
}

describe('external platform adapters', () => {
  it('creates every configured platform through the factory', () => {
    expect(createPlatformAdapter('bluesky')).toBeInstanceOf(BlueskyAdapter);
    expect(createPlatformAdapter('mastodon', { instanceUrl: 'https://mastodon.social' })).toBeInstanceOf(MastodonAdapter);
    expect(createPlatformAdapter('reddit')).toBeInstanceOf(RedditAdapter);
    expect(createPlatformAdapter('youtube', { apiKey: 'key' })).toBeInstanceOf(YouTubeAdapter);
    expect(createPlatformAdapter('tiktok', { accessToken: 'token' })).toBeInstanceOf(TikTokAdapter);
    expect(createPlatformAdapter('telegram', { botToken: 'token' })).toBeInstanceOf(TelegramAdapter);
    expect(createPlatformAdapter('threads', { accessToken: 'token', userId: 'me' })).toBeInstanceOf(ThreadsAdapter);
    expect(createPlatformAdapter('instagram', { accessToken: 'token', userId: 'me' })).toBeInstanceOf(InstagramAdapter);
  });

  it('maps Bluesky user and author feed calls to AT Protocol endpoints', async () => {
    const recorder = createRecorder([
      { did: 'did:plc:1', handle: 'alice.bsky.social' },
      { feed: [{ post: { uri: 'at://post/1' } }], cursor: 'next' },
    ]);
    const adapter = new BlueskyAdapter({ transport: recorder.transport });

    await expect(adapter.getUserData('alice.bsky.social')).resolves.toMatchObject({
      did: 'did:plc:1',
    });
    const posts = await adapter.getUserPosts('alice.bsky.social');

    expect(posts.data).toEqual([{ post: { uri: 'at://post/1' } }]);
    expect(recorder.requests.map((request) => request.path)).toEqual([
      '/xrpc/app.bsky.actor.getProfile',
      '/xrpc/app.bsky.feed.getAuthorFeed',
    ]);
  });

  it('maps Mastodon user and status calls to instance API endpoints', async () => {
    const recorder = createRecorder([
      [{ id: '1', username: 'alice' }],
      [{ id: 'status-1' }],
    ]);
    const adapter = new MastodonAdapter({
      instanceUrl: 'https://mastodon.social',
      transport: recorder.transport,
    });

    await adapter.getUserData('alice');
    const posts = await adapter.getUserPosts('1');

    expect(posts.data).toEqual([{ id: 'status-1' }]);
    expect(recorder.requests.map((request) => request.path)).toEqual([
      '/api/v2/search',
      '/api/v1/accounts/1/statuses',
    ]);
  });

  it('maps Reddit listing calls to oauth API paths', async () => {
    const recorder = createRecorder([
      { data: { children: [{ data: { id: 'post-1' } }], after: 't3_after' } },
    ]);
    const adapter = new RedditAdapter({ transport: recorder.transport });

    const posts = await adapter.getUserPosts('spez');

    expect(posts.data).toEqual([{ id: 'post-1' }]);
    expect(posts.cursor_endpoint).toBe('t3_after');
    expect(recorder.requests[0].path).toBe('/user/spez/submitted');
  });

  it('maps YouTube channel video search through Data API v3', async () => {
    const recorder = createRecorder([
      { items: [{ id: { videoId: 'video-1' } }], nextPageToken: 'page-2' },
    ]);
    const adapter = new YouTubeAdapter({
      apiKey: 'key',
      transport: recorder.transport,
    });

    const posts = await adapter.getUserPosts('channel-1');

    expect(posts.data).toEqual([{ id: { videoId: 'video-1' } }]);
    expect(recorder.requests[0].path).toBe('/youtube/v3/search');
    expect(recorder.requests[0].query).toMatchObject({
      channelId: 'channel-1',
      type: 'video',
      key: 'key',
    });
  });

  it('maps token based platforms to their official read endpoints', async () => {
    const tiktok = createRecorder([{ data: { videos: [{ id: 'v1' }], cursor: 1, has_more: false } }]);
    await new TikTokAdapter({ accessToken: 'token', transport: tiktok.transport }).getUserPosts('me');
    expect(tiktok.requests[0].path).toBe('/v2/video/list/');

    const telegram = createRecorder([{ ok: true, result: { id: 1 } }]);
    await new TelegramAdapter({ botToken: 'bot-token', transport: telegram.transport }).getMe();
    expect(telegram.requests[0].path).toBe('/botbot-token/getMe');

    const threads = createRecorder([{ data: [{ id: 'thread-1' }], paging: { cursors: { after: 'next' } } }]);
    await new ThreadsAdapter({ accessToken: 'token', userId: 'me', transport: threads.transport }).getUserPosts('me');
    expect(threads.requests[0].path).toBe('/v1.0/me/threads');

    const instagram = createRecorder([{ data: [{ id: 'media-1' }], paging: { cursors: { after: 'next' } } }]);
    await new InstagramAdapter({ accessToken: 'token', userId: 'me', transport: instagram.transport }).getUserPosts('me');
    expect(instagram.requests[0].path).toBe('/v19.0/me/media');
  });
});
