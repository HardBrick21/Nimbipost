import { UnsupportedOperationError } from '../../core/errors';
import type {
  PaginatedResult,
  PaginationOptions,
  PlatformAdapter,
  PlatformName,
} from '../../core/platform-adapter';

export interface GenericTransportRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  json?: unknown;
  path: string;
}

export type GenericTransport = (
  request: GenericTransportRequest,
) => Promise<unknown>;

export interface HttpAdapterOptions {
  baseUrl: string;
  accessToken?: string;
  headers?: Record<string, string>;
  transport?: GenericTransport;
}

export abstract class HttpPlatformAdapter implements PlatformAdapter {
  abstract readonly platform: PlatformName;
  protected baseUrl: string;
  protected accessToken?: string;
  protected headers: Record<string, string>;
  protected transport: GenericTransport;

  constructor(options: HttpAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.accessToken = options.accessToken;
    this.headers = options.headers ?? {};
    this.transport = options.transport ?? defaultTransport;
  }

  async init(): Promise<void> {}

  async getUserId(username: string | number): Promise<string> {
    return String(username);
  }

  async getUserData(username: string): Promise<unknown> {
    throw new UnsupportedOperationError(
      `${this.platform} does not implement getUserData.`,
    );
  }

  async getUserInfo(userId: string | number): Promise<unknown> {
    return this.getUserData(String(userId));
  }

  async getUserPosts(
    userId: string | number,
    _options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    throw new UnsupportedOperationError(
      `${this.platform} does not implement getUserPosts.`,
    );
  }

  async getPost(postId: string | number): Promise<unknown> {
    throw new UnsupportedOperationError(
      `${this.platform} does not implement getPost.`,
    );
  }

  async search(
    query: string,
    _options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    throw new UnsupportedOperationError(
      `${this.platform} does not implement search.`,
    );
  }

  protected async get(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    return this.request('GET', path, query, undefined, headers);
  }

  protected async post(
    path: string,
    json?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    return this.request('POST', path, query, json, headers);
  }

  protected async request(
    method: string,
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
    json?: unknown,
    headers?: Record<string, string>,
  ): Promise<unknown> {
    const resolvedHeaders = {
      ...this.headers,
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      ...(headers ?? {}),
    };
    const url = new URL(path, `${this.baseUrl}/`);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return this.transport({
      url: url.toString(),
      method,
      headers: resolvedHeaders,
      query,
      json,
      path,
    });
  }
}

export function paginatedFromArray<T>(
  data: T[],
  cursor?: string | null,
): PaginatedResult<T> {
  return {
    data,
    cursor_endpoint: cursor ?? null,
    has_next_page: Boolean(cursor),
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

async function defaultTransport(
  request: GenericTransportRequest,
): Promise<unknown> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: {
      ...(request.json ? { 'Content-Type': 'application/json' } : {}),
      ...request.headers,
    },
    body: request.json ? JSON.stringify(request.json) : undefined,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : {};
}
