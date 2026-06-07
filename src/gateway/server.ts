#!/usr/bin/env node
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createPlatformAdapter, type AdapterFactoryOptions } from '../index';
import type { PlatformAdapter, PlatformName } from '../core/platform-adapter';
import { UnsupportedOperationError } from '../core/errors';
import { loadGatewayConfig } from './config';

export type GatewayAdapterFactory = (
  platform: PlatformName,
  options?: AdapterFactoryOptions[PlatformName],
) => PlatformAdapter;

export interface GatewayServerOptions {
  adapterFactory?: GatewayAdapterFactory;
  adapterOptions?: AdapterFactoryOptions;
}

export async function initializeGatewayOptions(
  options: GatewayServerOptions = {},
): Promise<GatewayServerOptions> {
  const adapterFactory = createCachedAdapterFactory(options);
  const initializedOptions = { ...options, adapterFactory };
  const xAdapter = adapterFactory('x', options.adapterOptions?.x);

  try {
    await xAdapter.init();
    await xAdapter.updateApi?.();
  } catch (error) {
    process.stderr.write(
      `Nimbipost gateway could not update X API endpoints: ${errorMessage(error)}\n`,
    );
  }

  return initializedOptions;
}

interface JsonResponse {
  status: number;
  body: unknown;
}

class BadRequestError extends Error {}

const PLATFORM_NAMES = new Set<PlatformName>([
  'x',
  'bluesky',
  'mastodon',
  'reddit',
  'youtube',
  'tiktok',
  'telegram',
  'threads',
  'instagram',
]);

export function createGatewayServer(
  options: GatewayServerOptions = {},
): Server {
  return createServer(async (request, response) => {
    const result = await handleGatewayRequest(request, options);
    sendJson(response, result.status, result.body);
  });
}

export async function handleGatewayRequest(
  request: IncomingMessage,
  options: GatewayServerOptions = {},
): Promise<JsonResponse> {
  if (!request.url) {
    return errorResponse(400, 'Missing request URL');
  }

  const url = new URL(request.url, 'http://localhost');
  const method = request.method ?? 'GET';

  if (method !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  if (url.pathname === '/health') {
    return { status: 200, body: { status: 'ok' } };
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 3 || parts[0] !== 'v1') {
    return errorResponse(404, 'Route not found');
  }

  const platform = platformFromSegment(parts[1]);
  if (!platform) {
    return errorResponse(400, `Unsupported platform: ${parts[1]}`);
  }

  try {
    const adapter = createAdapter(platform, options);

    if (parts.length === 4 && parts[2] === 'users') {
      const username = decodeSegment(parts[3]);
      const data = await adapter.getUserData(username);
      return { status: 200, body: { platform, data } };
    }

    if (parts.length === 5 && parts[2] === 'users' && parts[4] === 'posts') {
      const username = decodeSegment(parts[3]);
      const total = positiveIntParam(url.searchParams.get('total'));
      const userId = await adapter.getUserId(username);
      const data = await adapter.getUserPosts(userId, total ? { total } : undefined);
      return { status: 200, body: { platform, ...data } };
    }

    if (parts.length === 5 && parts[2] === 'users' && parts[4] === 'friends') {
      if (!adapter.getFriends) {
        throw new UnsupportedOperationError(
          `${platform} does not support friends timelines`,
        );
      }

      const friendsOptions = friendsTimelineOptions(url.searchParams);
      const username = decodeSegment(parts[3]);
      const userId = await adapter.getUserId(username);
      const data = await adapter.getFriends(userId, friendsOptions);
      return { status: 200, body: { platform, ...data } };
    }

    if (parts.length === 4 && parts[2] === 'posts') {
      const postId = decodeSegment(parts[3]);
      const data = await adapter.getPost(postId);
      return { status: 200, body: { platform, data } };
    }

    if (parts.length === 3 && parts[2] === 'search') {
      const query = url.searchParams.get('q')?.trim();
      if (!query) {
        return errorResponse(400, 'Missing required query parameter: q');
      }

      const total = positiveIntParam(url.searchParams.get('total'));
      const data = await adapter.search(query, total ? { total } : undefined);
      return { status: 200, body: { platform, ...data } };
    }

    return errorResponse(404, 'Route not found');
  } catch (error) {
    return errorToResponse(error);
  }
}

function createAdapter(
  platform: PlatformName,
  options: GatewayServerOptions,
): PlatformAdapter {
  const adapterOptions = options.adapterOptions?.[platform];
  const factory =
    options.adapterFactory ?? (createPlatformAdapter as GatewayAdapterFactory);
  return factory(platform, adapterOptions);
}

function createCachedAdapterFactory(
  options: GatewayServerOptions,
): GatewayAdapterFactory {
  const cache = new Map<PlatformName, PlatformAdapter>();
  const factory =
    options.adapterFactory ?? (createPlatformAdapter as GatewayAdapterFactory);

  return (platform, adapterOptions) => {
    const cached = cache.get(platform);
    if (cached) {
      return cached;
    }

    const adapter = factory(platform, adapterOptions);
    cache.set(platform, adapter);
    return adapter;
  };
}

function platformFromSegment(value: string): PlatformName | null {
  return PLATFORM_NAMES.has(value as PlatformName) ? (value as PlatformName) : null;
}

function decodeSegment(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, '%20'));
}

function positiveIntParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function friendsTimelineOptions(
  searchParams: URLSearchParams,
): {
  follower?: boolean;
  following?: boolean;
  mutualFollower?: boolean;
  total?: number;
  endCursor?: string;
  pagination?: boolean;
} {
  const follower = booleanParam(searchParams.get('follower'));
  const following = booleanParam(searchParams.get('following'));
  const mutualFollower = booleanParam(searchParams.get('mutualFollower'));
  const selectedModes = [follower, following, mutualFollower].filter(Boolean);

  if (selectedModes.length !== 1) {
    throw new BadRequestError('Set exactly one friends timeline mode.');
  }

  const options: {
    follower?: boolean;
    following?: boolean;
    mutualFollower?: boolean;
    total?: number;
    endCursor?: string;
    pagination?: boolean;
  } = {};

  if (follower) {
    options.follower = true;
  }

  if (following) {
    options.following = true;
  }

  if (mutualFollower) {
    options.mutualFollower = true;
  }

  const total = positiveIntParam(searchParams.get('total'));
  if (total) {
    options.total = total;
  }

  const cursor = searchParams.get('cursor')?.trim();
  if (cursor) {
    options.endCursor = cursor;
  }

  const pagination = searchParams.get('pagination');
  if (pagination !== null) {
    options.pagination = booleanParam(pagination);
  }

  return options;
}

function booleanParam(value: string | null): boolean {
  return value === 'true' || value === '1';
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  response.end(json);
}

function errorToResponse(error: unknown): JsonResponse {
  if (error instanceof BadRequestError) {
    return errorResponse(400, error.message);
  }

  if (error instanceof UnsupportedOperationError) {
    return errorResponse(501, error.message);
  }

  if (error instanceof Error) {
    return errorResponse(500, error.message);
  }

  return errorResponse(500, 'Gateway request failed');
}

function errorResponse(status: number, message: string): JsonResponse {
  return { status, body: { error: message } };
}

if (isMainModule()) {
  void startGateway();
}

async function startGateway(): Promise<void> {
  const config = loadGatewayConfig();
  const options = await initializeGatewayOptions({
    adapterOptions: config.adapterOptions,
  });
  const server = createGatewayServer(options);

  server.listen(config.port, config.host, () => {
    process.stdout.write(
      `Nimbipost gateway listening on http://${config.host}:${config.port}\n`,
    );
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMainModule(): boolean {
  const entry = process.argv[1]?.replaceAll('\\', '/') ?? '';
  return (
    entry.endsWith('/dist/gateway/server.js') ||
    entry.endsWith('/dist/gateway/server.cjs') ||
    entry.endsWith('/src/gateway/server.ts')
  );
}
