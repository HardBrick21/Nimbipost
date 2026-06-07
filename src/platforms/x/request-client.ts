import { RateLimitError } from '../../core/errors';
import { getHeader, parseRateLimit, type RateLimitStats } from './rate-limit';
import type { XSessionSnapshot } from './session-store';

export type { RateLimitStats } from './rate-limit';

export interface TransactionLike {
  generateTransactionId(method: string, path: string): string;
}

export interface TransportRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  params?: Record<string, string>;
  json?: unknown;
  body?: BodyInit | null;
}

export interface TransportResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: string;
}

export type Transport = (
  request: TransportRequest,
) => Promise<TransportResponse | (TransportResponse & Record<string, unknown>)>;

export interface XRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  json?: unknown;
  body?: BodyInit | null;
  skipErrorChecking?: boolean;
}

export interface XRequestClientOptions {
  transaction?: TransactionLike;
  transport?: Transport;
  baseHeaders?: Record<string, string>;
}

export class XRequestClient {
  private transaction?: TransactionLike;
  private transport: Transport;
  private baseHeaders: Record<string, string>;
  private cookies: Record<string, string>;
  lastRequest?: TransportRequest;
  lastResponse?: TransportResponse;

  constructor(options: XRequestClientOptions = {}) {
    this.transaction = options.transaction;
    this.transport = options.transport ?? defaultFetchTransport;
    this.baseHeaders = options.baseHeaders ?? {};
    this.cookies = {};
  }

  setTransaction(transaction: TransactionLike): void {
    this.transaction = transaction;
  }

  setHeaders(headers: Record<string, string>): void {
    this.baseHeaders = { ...this.baseHeaders, ...headers };
  }

  setCookies(cookies: Record<string, string>): void {
    this.cookies = { ...this.cookies, ...cookies };
  }

  getSessionSnapshot(): XSessionSnapshot {
    return {
      headers: { ...this.baseHeaders },
      cookies: { ...this.cookies },
    };
  }

  restoreSession(snapshot: XSessionSnapshot): void {
    this.baseHeaders = { ...snapshot.headers };
    this.cookies = { ...snapshot.cookies };
  }

  async request(
    url: string,
    options: XRequestOptions = {},
  ): Promise<Record<string, unknown>> {
    const method = (options.method ?? 'GET').toUpperCase();
    const headers = {
      ...this.baseHeaders,
      ...(options.headers ?? {}),
    };
    const cookieHeader = serializeCookies(this.cookies);

    if (cookieHeader) {
      headers.Cookie = headers.Cookie
        ? `${headers.Cookie}; ${cookieHeader}`
        : cookieHeader;
    }

    if (this.transaction) {
      headers['X-Client-Transaction-Id'] =
        this.transaction.generateTransactionId(method, new URL(url).pathname);
    }

    const request: TransportRequest = {
      url,
      method,
      headers,
      params: options.params,
      json: options.json,
      body: options.body,
    };
    this.lastRequest = request;

    const response = await this.transport(request);
    this.lastResponse = response;
    const rateLimit = parseRateLimit(response.headers);
    const contentType = getHeader(response.headers, 'content-type') ?? '';

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.body}`);
    }

    if (!contentType.includes('json')) {
      return { text: response.body };
    }

    const parsed = JSON.parse(response.body) as Record<string, unknown>;

    if (rateLimit) {
      parsed.api_rate_limit = rateLimit;
    }

    if (options.skipErrorChecking) {
      return parsed;
    }

    return checkForErrors(parsed, rateLimit);
  }
}

function serializeCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('; ');
}

function checkForErrors(
  response: Record<string, unknown>,
  rateLimit?: RateLimitStats,
) {
  const errors = [
    ...asArray(response.errors),
    ...asArray(response.error),
  ] as Array<Record<string, unknown>>;

  if (errors.length && !response.data) {
    if (rateLimit?.rate_limit_exhausted) {
      throw new RateLimitError();
    }

    throw new Error(
      errors
        .map((error) =>
          error.code
            ? `Error code ${String(error.code)} - ${String(error.message)}`
            : String(error.message),
        )
        .join('\n'),
    );
  }

  return response;
}

function asArray(value: unknown): unknown[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

async function defaultFetchTransport(
  request: TransportRequest,
): Promise<TransportResponse> {
  const url = new URL(request.url);

  for (const [key, value] of Object.entries(request.params ?? {})) {
    url.searchParams.set(key, value);
  }

  const headers = { ...request.headers };
  let body = request.body;

  if (request.json !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    body = JSON.stringify(request.json);
  }

  const response = await fetch(url, {
    method: request.method,
    headers,
    body,
  });
  const headersByName = Object.fromEntries(response.headers.entries());
  const setCookieHeader = response.headers.get('set-cookie');

  if (setCookieHeader) {
    headersByName['set-cookie'] = setCookieHeader;
  }

  return {
    status: response.status,
    headers: headersByName,
    body: await response.text(),
  };
}
