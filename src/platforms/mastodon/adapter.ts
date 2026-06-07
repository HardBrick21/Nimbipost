import type { PaginationOptions, PaginatedResult } from '../../core/platform-adapter';
import { asRecord, HttpPlatformAdapter, paginatedFromArray, type GenericTransport } from '../common/http-adapter';

export interface MastodonAdapterOptions {
  instanceUrl?: string;
  accessToken?: string;
  transport?: GenericTransport;
}

export class MastodonAdapter extends HttpPlatformAdapter {
  readonly platform = 'mastodon' as const;

  constructor(options: MastodonAdapterOptions = {}) {
    super({
      baseUrl: options.instanceUrl ?? 'https://mastodon.social',
      accessToken: options.accessToken,
      transport: options.transport,
    });
  }

  async getUserData(username: string): Promise<unknown> {
    const response = await this.get('/api/v2/search', {
      q: username,
      type: 'accounts',
      limit: 1,
      resolve: true,
    });
    const accounts = asRecord(response).accounts;

    return Array.isArray(accounts) ? accounts[0] : undefined;
  }

  async getUserInfo(userId: string | number): Promise<unknown> {
    return this.get(`/api/v1/accounts/${encodeURIComponent(String(userId))}`);
  }

  async getUserPosts(userId: string | number, options: PaginationOptions = {}): Promise<PaginatedResult> {
    const response = await this.get(`/api/v1/accounts/${encodeURIComponent(String(userId))}/statuses`, {
      max_id: options.endCursor,
      limit: options.total,
    });

    return paginatedFromArray(Array.isArray(response) ? response : []);
  }

  async getPost(postId: string | number): Promise<unknown> {
    return this.get(`/api/v1/statuses/${encodeURIComponent(String(postId))}`);
  }

  async search(query: string, options: PaginationOptions = {}): Promise<PaginatedResult> {
    const response = asRecord(await this.get('/api/v2/search', {
      q: query,
      type: 'statuses',
      limit: options.total,
      max_id: options.endCursor,
    }));

    return paginatedFromArray(Array.isArray(response.statuses) ? response.statuses : []);
  }
}
