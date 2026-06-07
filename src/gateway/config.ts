import type { AdapterFactoryOptions } from '../index';

export interface GatewayConfig {
  host: string;
  port: number;
  adapterOptions: AdapterFactoryOptions;
}

export function loadGatewayConfig(
  env: NodeJS.ProcessEnv = process.env,
): GatewayConfig {
  return {
    host: env.NIMBIPOST_HOST || '0.0.0.0',
    port: parsePort(env.NIMBIPOST_PORT || env.PORT, 4334),
    adapterOptions: {
      x: {
        authToken: env.X_AUTH_TOKEN,
        publicBearerToken: env.X_PUBLIC_BEARER_TOKEN,
      },
      bluesky: {
        serviceUrl: env.BLUESKY_SERVICE_URL,
        accessToken: env.BLUESKY_ACCESS_TOKEN,
      },
      mastodon: {
        instanceUrl: env.MASTODON_INSTANCE_URL,
        accessToken: env.MASTODON_ACCESS_TOKEN,
      },
      reddit: {
        accessToken: env.REDDIT_ACCESS_TOKEN,
      },
      youtube: {
        apiKey: env.YOUTUBE_API_KEY ?? '',
        accessToken: env.YOUTUBE_ACCESS_TOKEN,
      },
      tiktok: {
        accessToken: env.TIKTOK_ACCESS_TOKEN ?? '',
      },
      telegram: {
        botToken: env.TELEGRAM_BOT_TOKEN ?? '',
      },
      threads: {
        accessToken: env.THREADS_ACCESS_TOKEN ?? '',
        userId: env.THREADS_USER_ID || 'me',
      },
      instagram: {
        accessToken: env.INSTAGRAM_ACCESS_TOKEN ?? '',
        userId: env.INSTAGRAM_USER_ID || 'me',
        graphVersion: env.INSTAGRAM_GRAPH_VERSION,
      },
    },
  };
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    return fallback;
  }

  return port;
}
