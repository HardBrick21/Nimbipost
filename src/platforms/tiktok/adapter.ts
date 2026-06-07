import type { PaginationOptions, PaginatedResult } from '../../core/platform-adapter';
import { asRecord, HttpPlatformAdapter, paginatedFromArray, type GenericTransport } from '../common/http-adapter';

export interface TikTokAdapterOptions {
  accessToken: string;
  transport?: GenericTransport;
}

export class TikTokAdapter extends HttpPlatformAdapter {
  readonly platform = 'tiktok' as const;

  constructor(options: TikTokAdapterOptions) {
    super({
      baseUrl: 'https://open.tiktokapis.com',
      accessToken: options.accessToken,
      transport: options.transport,
    });
  }

  async getUserData(_username: string): Promise<unknown> {
    return this.get('/v2/user/info/', {
      fields: 'open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link',
    });
  }

  async getUserPosts(_userId: string | number, options: PaginationOptions = {}): Promise<PaginatedResult> {
    const response = asRecord(await this.post('/v2/video/list/', {
      max_count: options.total,
      cursor: options.endCursor ? Number(options.endCursor) : undefined,
    }));
    const data = asRecord(response.data);

    return paginatedFromArray(
      Array.isArray(data.videos) ? data.videos : [],
      data.has_more && data.cursor !== undefined ? String(data.cursor) : null,
    );
  }

  async getPost(postId: string | number): Promise<unknown> {
    return this.post('/v2/video/query/', {
      filters: { video_ids: [String(postId)] },
    });
  }
}
