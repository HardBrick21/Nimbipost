import { UnsupportedOperationError } from './core/errors';
import type { PlatformAdapter, PlatformName } from './core/platform-adapter';
import { BlueskyAdapter, type BlueskyAdapterOptions } from './platforms/bluesky/adapter';
import { InstagramAdapter, type InstagramAdapterOptions } from './platforms/instagram/adapter';
import { MastodonAdapter, type MastodonAdapterOptions } from './platforms/mastodon/adapter';
import { RedditAdapter, type RedditAdapterOptions } from './platforms/reddit/adapter';
import { TelegramAdapter, type TelegramAdapterOptions } from './platforms/telegram/adapter';
import { ThreadsAdapter, type ThreadsAdapterOptions } from './platforms/threads/adapter';
import { TikTokAdapter, type TikTokAdapterOptions } from './platforms/tiktok/adapter';
import { YouTubeAdapter, type YouTubeAdapterOptions } from './platforms/youtube/adapter';
import { XAdapter, type XAdapterOptions } from './platforms/x/adapter';

export { RateLimitError, UnsupportedOperationError } from './core/errors';
export type {
  FollowingTimelineOptions,
  PaginatedResult,
  PaginationOptions,
  PlatformAdapter,
  PlatformName,
} from './core/platform-adapter';
export { BlueskyAdapter } from './platforms/bluesky/adapter';
export type { BlueskyAdapterOptions } from './platforms/bluesky/adapter';
export { InstagramAdapter } from './platforms/instagram/adapter';
export type { InstagramAdapterOptions } from './platforms/instagram/adapter';
export { MastodonAdapter } from './platforms/mastodon/adapter';
export type { MastodonAdapterOptions } from './platforms/mastodon/adapter';
export { RedditAdapter } from './platforms/reddit/adapter';
export type { RedditAdapterOptions } from './platforms/reddit/adapter';
export { TelegramAdapter } from './platforms/telegram/adapter';
export type { TelegramAdapterOptions } from './platforms/telegram/adapter';
export { ThreadsAdapter } from './platforms/threads/adapter';
export type { ThreadsAdapterOptions } from './platforms/threads/adapter';
export { TikTokAdapter } from './platforms/tiktok/adapter';
export type { TikTokAdapterOptions } from './platforms/tiktok/adapter';
export { YouTubeAdapter } from './platforms/youtube/adapter';
export type { YouTubeAdapterOptions } from './platforms/youtube/adapter';
export type {
  GenericTransport,
  GenericTransportRequest,
} from './platforms/common/http-adapter';
export { XAdapter } from './platforms/x/adapter';
export type { XAdapterOptions } from './platforms/x/adapter';
export { XApiUpdater } from './platforms/x/api-updater';
export type {
  ApiEndpointMetadata,
  FeatureSwitchDefaults,
} from './platforms/x/api-updater';
export {
  XLoginTaskHandler,
  generateTotp,
} from './platforms/x/login-task-handler';
export { Tweet, User, findNestedKey } from './platforms/x/models';
export type { NestedKey } from './platforms/x/models';
export type {
  LoginCredentials,
  LoginRequestClient,
  XLoginTaskHandlerOptions,
} from './platforms/x/login-task-handler';
export { XRequestClient } from './platforms/x/request-client';
export type {
  RateLimitStats,
  Transport,
  TransportRequest,
  TransportResponse,
} from './platforms/x/request-client';
export { loadSessionFile, saveSessionFile } from './platforms/x/session-store';
export type { XSessionSnapshot } from './platforms/x/session-store';

export interface AdapterFactoryOptions {
  x?: XAdapterOptions;
  bluesky?: BlueskyAdapterOptions;
  mastodon?: MastodonAdapterOptions;
  reddit?: RedditAdapterOptions;
  youtube?: YouTubeAdapterOptions;
  tiktok?: TikTokAdapterOptions;
  telegram?: TelegramAdapterOptions;
  threads?: ThreadsAdapterOptions;
  instagram?: InstagramAdapterOptions;
}

export function createPlatformAdapter(
  platform: 'x',
  options?: XAdapterOptions,
): PlatformAdapter;
export function createPlatformAdapter(
  platform: 'bluesky',
  options?: BlueskyAdapterOptions,
): PlatformAdapter;
export function createPlatformAdapter(
  platform: 'mastodon',
  options?: MastodonAdapterOptions,
): PlatformAdapter;
export function createPlatformAdapter(
  platform: 'reddit',
  options?: RedditAdapterOptions,
): PlatformAdapter;
export function createPlatformAdapter(
  platform: 'youtube',
  options: YouTubeAdapterOptions,
): PlatformAdapter;
export function createPlatformAdapter(
  platform: 'tiktok',
  options: TikTokAdapterOptions,
): PlatformAdapter;
export function createPlatformAdapter(
  platform: 'telegram',
  options: TelegramAdapterOptions,
): PlatformAdapter;
export function createPlatformAdapter(
  platform: 'threads',
  options: ThreadsAdapterOptions,
): PlatformAdapter;
export function createPlatformAdapter(
  platform: 'instagram',
  options: InstagramAdapterOptions,
): PlatformAdapter;
export function createPlatformAdapter(
  platform: PlatformName,
  options:
    | XAdapterOptions
    | BlueskyAdapterOptions
    | MastodonAdapterOptions
    | RedditAdapterOptions
    | YouTubeAdapterOptions
    | TikTokAdapterOptions
    | TelegramAdapterOptions
    | ThreadsAdapterOptions
    | InstagramAdapterOptions = {},
): PlatformAdapter {
  if (platform === 'x') {
    return new XAdapter(options as XAdapterOptions);
  }

  if (platform === 'bluesky') {
    return new BlueskyAdapter(options as BlueskyAdapterOptions);
  }

  if (platform === 'mastodon') {
    return new MastodonAdapter(options as MastodonAdapterOptions);
  }

  if (platform === 'reddit') {
    return new RedditAdapter(options as RedditAdapterOptions);
  }

  if (platform === 'youtube') {
    return new YouTubeAdapter(options as YouTubeAdapterOptions);
  }

  if (platform === 'tiktok') {
    return new TikTokAdapter(options as TikTokAdapterOptions);
  }

  if (platform === 'telegram') {
    return new TelegramAdapter(options as TelegramAdapterOptions);
  }

  if (platform === 'threads') {
    return new ThreadsAdapter(options as ThreadsAdapterOptions);
  }

  if (platform === 'instagram') {
    return new InstagramAdapter(options as InstagramAdapterOptions);
  }

  throw new UnsupportedOperationError(`Unsupported platform: ${platform}`);
}
