import {
  ClientTransaction,
  generateHeaders,
  getOndemandFileUrl,
  handleXMigrationAsync,
} from '@hardbrick21/x-txid-generator';
import { X_PATHS } from './endpoints';
import { XRequestClient, type Transport } from './request-client';
import type { XSessionSnapshot } from './session-store';

export const X_PUBLIC_BEARER_TOKEN =
  'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

export interface XSessionOptions {
  authToken?: string;
  publicBearerToken?: string;
  transport?: Transport;
}

export interface XSession {
  requestClient: XRequestClient;
  guestToken: string;
  snapshot: XSessionSnapshot;
}

export async function createGuestSession(
  options: XSessionOptions = {},
): Promise<XSession> {
  const headers = generateHeaders();
  const requestClient = new XRequestClient({
    baseHeaders: headers,
    transport: options.transport,
  });
  const migrationSession = {
    request: async (
      optionsOrMethod:
        | { method: string; url: string; data?: Record<string, string> }
        | string,
      requestUrl?: string,
      data?: Record<string, string>,
    ) => {
      const request =
        typeof optionsOrMethod === 'string'
          ? { method: optionsOrMethod, url: requestUrl ?? '', data }
          : optionsOrMethod;
      const response = await requestClient.request(request.url, {
        method: request.method,
        body: request.data ? new URLSearchParams(request.data) : undefined,
        skipErrorChecking: true,
      });

      return { content: String(response.text ?? '') };
    },
  };
  const homePageHtml = await handleXMigrationAsync(migrationSession);
  const ondemandUrl = getOndemandFileUrl(homePageHtml);
  const ondemandResponse = await fetch(ondemandUrl, { headers });
  const ondemandFileJs = await ondemandResponse.text();
  const transaction = new ClientTransaction(homePageHtml, ondemandFileJs);

  requestClient.setTransaction(transaction);
  if (options.authToken) {
    requestClient.setCookies({ auth_token: options.authToken });
    await bootstrapAuthenticatedSession(requestClient);
  }

  requestClient.setHeaders({
    Authorization: options.publicBearerToken ?? X_PUBLIC_BEARER_TOKEN,
  });

  const guestResponse = await requestClient.request(X_PATHS.GUEST_TOKEN_URL, {
    method: 'POST',
  });
  const guestToken = String(
    guestResponse.guest_token ?? findGuestToken(homePageHtml),
  );

  requestClient.setHeaders({
    'X-Guest-Token': guestToken,
  });
  requestClient.setCookies({
    gt: guestToken,
  });

  return { requestClient, guestToken, snapshot: requestClient.getSessionSnapshot() };
}

async function bootstrapAuthenticatedSession(
  requestClient: XRequestClient,
): Promise<void> {
  await requestClient.request(X_PATHS.BASE_URL, {
    skipErrorChecking: true,
  });

  const cookies = parseSetCookieHeader(
    requestClient.lastResponse?.headers['set-cookie'],
  );
  const csrfToken = cookies.ct0;

  if (!csrfToken) {
    throw new Error("Couldn't get ct0 csrf token for auth token");
  }

  requestClient.setCookies(cookies);
  requestClient.setHeaders({
    'X-Csrf-Token': csrfToken,
    'X-Twitter-Auth-Type': 'OAuth2Session',
  });
}

function parseSetCookieHeader(value: string | undefined): Record<string, string> {
  if (!value) {
    return {};
  }

  const cookies: Record<string, string> = {};
  const cookieMatches = value.matchAll(
    /(?:^|,\s*)([A-Za-z0-9_]+)=([^;]+)(?=;)/g,
  );

  for (const match of cookieMatches) {
    cookies[match[1]] = match[2];
  }

  return cookies;
}

function findGuestToken(pageSource: string): string {
  const guestToken = pageSource.match(/gt=(\d+);/)?.[1];

  if (!guestToken) {
    throw new Error("Couldn't find guest token");
  }

  return guestToken;
}
