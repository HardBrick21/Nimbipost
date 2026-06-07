import type { PaginationOptions, PaginatedResult } from '../../core/platform-adapter';
import { asRecord, HttpPlatformAdapter, paginatedFromArray, type GenericTransport } from '../common/http-adapter';

export interface YouTubeAdapterOptions {
  apiKey: string;
  accessToken?: string;
  transport?: GenericTransport;
}

export class YouTubeAdapter extends HttpPlatformAdapter {
  readonly platform = 'youtube' as const;
  private apiKey: string;

  constructor(options: YouTubeAdapterOptions) {
    super({
      baseUrl: 'https://www.googleapis.com',
      accessToken: options.accessToken,
      transport: options.transport,
    });
    this.apiKey = options.apiKey;
  }

  async getUserData(channelId: string): Promise<unknown> {
    return this.get('/youtube/v3/channels', {
      part: 'snippet,statistics,contentDetails',
      id: channelId,
      key: this.apiKey,
    });
  }

  async getUserInfo(channelId: string | number): Promise<unknown> {
    return this.getUserData(String(channelId));
  }

  async getUserPosts(channelId: string | number, options: PaginationOptions = {}): Promise<PaginatedResult> {
    const response = asRecord(await this.get('/youtube/v3/search', {
      part: 'id,snippet',
      channelId: String(channelId),
      type: 'video',
      order: 'date',
      pageToken: options.endCursor,
      maxResults: options.total,
      key: this.apiKey,
    }));

    return paginatedFromArray(
      Array.isArray(response.items) ? response.items : [],
      typeof response.nextPageToken === 'string' ? response.nextPageToken : null,
    );
  }

  async getPost(videoId: string | number): Promise<unknown> {
    return this.get('/youtube/v3/videos', {
      part: 'snippet,statistics,contentDetails',
      id: String(videoId),
      key: this.apiKey,
    });
  }

  async search(query: string, options: PaginationOptions = {}): Promise<PaginatedResult> {
    const response = asRecord(await this.get('/youtube/v3/search', {
      part: 'id,snippet',
      q: query,
      pageToken: options.endCursor,
      maxResults: options.total,
      key: this.apiKey,
    }));

    return paginatedFromArray(
      Array.isArray(response.items) ? response.items : [],
      typeof response.nextPageToken === 'string' ? response.nextPageToken : null,
    );
  }
}
