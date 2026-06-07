import type { PaginationOptions, PaginatedResult } from '../../core/platform-adapter';
import { asRecord, HttpPlatformAdapter, paginatedFromArray, type GenericTransport } from '../common/http-adapter';

export interface BlueskyAdapterOptions {
  serviceUrl?: string;
  accessToken?: string;
  transport?: GenericTransport;
}

export class BlueskyAdapter extends HttpPlatformAdapter {
  readonly platform = 'bluesky' as const;

  constructor(options: BlueskyAdapterOptions = {}) {
    super({
      baseUrl: options.serviceUrl ?? 'https://public.api.bsky.app',
      accessToken: options.accessToken,
      transport: options.transport,
    });
  }

  async getUserData(username: string): Promise<unknown> {
    return this.get('/xrpc/app.bsky.actor.getProfile', { actor: username });
  }

  async getUserInfo(userId: string | number): Promise<unknown> {
    return this.getUserData(String(userId));
  }

  async getUserPosts(
    userId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    const response = asRecord(
      await this.get('/xrpc/app.bsky.feed.getAuthorFeed', {
        actor: String(userId),
        cursor: options.endCursor,
        limit: options.total,
      }),
    );

    return paginatedFromArray(
      Array.isArray(response.feed) ? response.feed : [],
      typeof response.cursor === 'string' ? response.cursor : null,
    );
  }

  async getPost(postId: string | number): Promise<unknown> {
    return this.get('/xrpc/app.bsky.feed.getPosts', { uris: String(postId) });
  }

  async search(query: string, options: PaginationOptions = {}): Promise<PaginatedResult> {
    const response = asRecord(
      await this.get('/xrpc/app.bsky.feed.searchPosts', {
        q: query,
        cursor: options.endCursor,
        limit: options.total,
      }),
    );

    return paginatedFromArray(
      Array.isArray(response.posts) ? response.posts : [],
      typeof response.cursor === 'string' ? response.cursor : null,
    );
  }
}
