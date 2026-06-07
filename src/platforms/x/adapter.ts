import { UnsupportedOperationError } from '../../core/errors';
import type {
  PaginatedResult,
  PaginationOptions,
  PlatformAdapter,
} from '../../core/platform-adapter';
import { X_PATHS, graphqlUrl } from './endpoints';
import { generateFeatures, type FeatureOptions } from './features';
import { XApiUpdater } from './api-updater';
import { XLoginTaskHandler, type LoginCredentials } from './login-task-handler';
import { handleTimelinePagination } from './pagination';
import { type XSessionOptions, createGuestSession } from './session';
import type { XRequestClient } from './request-client';
import {
  loadSessionFile,
  saveSessionFile,
  type XSessionSnapshot,
} from './session-store';

export interface XAdapterOptions extends XSessionOptions {
  autoInit?: boolean;
  requestClient?: XAdapterRequestClient;
}

interface XAdapterRequestClient {
  request: XRequestClient['request'];
  getSessionSnapshot?: XRequestClient['getSessionSnapshot'];
  restoreSession?: XRequestClient['restoreSession'];
  setCookies?: XRequestClient['setCookies'];
}

export class XAdapter implements PlatformAdapter {
  readonly platform = 'x' as const;
  private requestClient?: XAdapterRequestClient;
  private autoInit: boolean;
  private sessionOptions: XSessionOptions;

  constructor(options: XAdapterOptions = {}) {
    this.requestClient = options.requestClient;
    this.autoInit = options.autoInit ?? true;
    this.sessionOptions = {
      authToken: options.authToken,
      publicBearerToken: options.publicBearerToken,
      transport: options.transport,
    };

    if (options.authToken && this.requestClient?.setCookies) {
      this.requestClient.setCookies({ auth_token: options.authToken });
    }
  }

  async init(): Promise<void> {
    if (this.requestClient) {
      return;
    }

    const session = await createGuestSession(this.sessionOptions);
    this.requestClient = session.requestClient;
  }

  async generateSession(options: XSessionOptions = {}): Promise<XSessionSnapshot> {
    const authToken = options.authToken ?? this.sessionOptions.authToken;

    if (this.requestClient && !options.transport) {
      if (authToken && this.requestClient.setCookies) {
        this.requestClient.setCookies({ auth_token: authToken });
      }

      if (this.requestClient.getSessionSnapshot) {
        return this.requestClient.getSessionSnapshot();
      }
    }

    const session = await createGuestSession({
      ...this.sessionOptions,
      ...options,
      authToken,
    });
    this.requestClient = session.requestClient;

    return session.snapshot;
  }

  loggedIn(): boolean {
    return Boolean(this.requestClient?.getSessionSnapshot?.().cookies.auth_token);
  }

  async getUserId(username: string | number): Promise<string> {
    const usernameValue = String(username);
    if (/^\d+$/.test(usernameValue)) {
      return usernameValue;
    }

    const userData = (await this.getUserData(usernameValue)) as Record<
      string,
      unknown
    >;
    const restId = userData.rest_id;

    if (!restId) {
      throw new Error(`Could not resolve user id for ${usernameValue}`);
    }

    return String(restId);
  }

  async getUserData(username: string): Promise<unknown> {
    const request = this.generateRequestData(
      X_PATHS.USER_DATA_ENDPOINT,
      {
        screen_name: username,
        withSafetyModeUserFields: true,
      },
      { userInfoFeatures: true },
    );
    const response = await this.request(request.url, { params: request.params });

    return getPath(response, ['data', 'user', 'result']);
  }

  async getUserInfo(userId: string | number): Promise<unknown> {
    const resolvedUserId = await this.getUserId(userId);
    const request = this.generateRequestData(
      X_PATHS.USER_INFO_ENDPOINT,
      {
        userId: resolvedUserId,
        withSafetyModeUserFields: true,
      },
      { userDataFeatures: true },
    );
    const response = await this.request(request.url, { params: request.params });

    return getPath(response, ['data', 'user', 'result']);
  }

  async getMultipleUsersData(userIds: Array<string | number>): Promise<unknown> {
    const request = this.generateRequestData(
      X_PATHS.MULTIPLE_USERS_DATA_ENDPOINT,
      { userIds: userIds.map(String) },
      { defaultFeatures: true },
    );
    const response = await this.request(request.url, { params: request.params });

    return getPath(response, ['data', 'users']);
  }

  async getMe(): Promise<unknown> {
    const request = this.generateRequestData(
      X_PATHS.VIEWER_ENDPOINT,
      {
        withCommunitiesMemberships: true,
        withSubscribedTab: true,
        withCommunitiesCreation: true,
      },
      { userDataFeatures: true },
    );

    return this.request(request.url, { params: request.params });
  }

  async getUserTweets(
    userId: string | number,
    options: PaginationOptions & { withReplies?: boolean } = {},
  ): Promise<PaginatedResult> {
    const resolvedUserId = await this.getUserId(userId);
    const withReplies = options.withReplies ?? false;
    const endpoint = withReplies
      ? X_PATHS.USER_TWEETS_AND_REPLIES_ENDPOINT
      : X_PATHS.USER_TWEETS_ENDPOINT;
    const variables: Record<string, unknown> = {
      userId: resolvedUserId,
      count: withReplies ? 20 : 100,
      includePromotedContent: true,
      withVoice: true,
      withV2Timeline: true,
    };

    if (withReplies) {
      variables.withCommunity = true;
    } else {
      variables.withQuickPromoteEligibilityTweetFields = true;
    }

    const request = this.generateRequestData(endpoint, variables, {
      additionalFeatures: true,
    });

    return handleTimelinePagination({
      requestClient: await this.getRequestClient(),
      url: request.url,
      params: request.params,
      dataPath: ['data', 'user', 'result', 'timeline', 'timeline', 'instructions'],
      endCursor: options.endCursor,
      total: options.total,
      pagination: options.pagination,
    });
  }

  async getUserPosts(
    userId: string | number,
    options: PaginationOptions & { withReplies?: boolean } = {},
  ): Promise<PaginatedResult> {
    return this.getUserTweets(userId, options);
  }

  async getUserMedia(
    userId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    const resolvedUserId = await this.getUserId(userId);
    const request = this.generateRequestData(
      X_PATHS.USER_MEDIA_ENDPOINT,
      {
        userId: resolvedUserId,
        count: 100,
        includePromotedContent: false,
        withClientEventToken: false,
        withBirdwatchNotes: false,
        withVoice: true,
        withV2Timeline: true,
      },
      { additionalFeatures: true },
    );

    return this.paginate(request, [
      'data',
      'user',
      'result',
      'timeline_v2',
      'timeline',
      'instructions',
    ], options);
  }

  async getTweet(
    tweetId: string | number,
    options: PaginationOptions & { withTweetReplies?: boolean } = {},
  ): Promise<unknown> {
    if (options.endCursor && !options.withTweetReplies) {
      throw new Error('Either set withTweetReplies to true or omit endCursor.');
    }

    const variables = {
      focalTweetId: String(tweetId),
      referrer: options.withTweetReplies ? 'tweet' : 'profile',
      with_rux_injections: false,
      includePromotedContent: true,
      withCommunity: true,
      withQuickPromoteEligibilityTweetFields: true,
      withArticleRichContent: false,
      withBirdwatchNotes: false,
      withVoice: true,
      withV2Timeline: true,
    };
    const request = this.generateRequestData(
      X_PATHS.TWEET_DETAILS_ENDPOINT,
      variables,
      { additionalFeatures: true },
    );

    if (options.withTweetReplies) {
      return handleTimelinePagination({
        requestClient: await this.getRequestClient(),
        url: request.url,
        params: request.params,
        dataPath: [
          'data',
          'threaded_conversation_with_injections_v2',
          'instructions',
        ],
        endCursor: options.endCursor,
        total: options.total,
        pagination: options.pagination,
      });
    }

    return this.request(request.url, { params: request.params });
  }

  async getPost(
    postId: string | number,
    options: PaginationOptions & { withTweetReplies?: boolean } = {},
  ): Promise<unknown> {
    return this.getTweet(postId, options);
  }

  async search(
    query: string,
    options: PaginationOptions & { searchFilter?: string } = {},
  ): Promise<PaginatedResult> {
    const request = this.generateRequestData(
      X_PATHS.SEARCH_ENDPOINT,
      {
        rawQuery: query,
        count: 20,
        querySource: 'typed_query',
        product: options.searchFilter ?? 'Top',
      },
      { additionalFeatures: true },
    );

    return handleTimelinePagination({
      requestClient: await this.getRequestClient(),
      url: request.url,
      params: request.params,
      dataPath: [
        'data',
        'search_by_raw_query',
        'search_timeline',
        'timeline',
        'instructions',
      ],
      endCursor: options.endCursor,
      total: options.total,
      pagination: options.pagination,
    });
  }

  async getLikedTweets(
    userId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    const resolvedUserId = await this.getUserId(userId);
    const request = this.generateRequestData(
      X_PATHS.LIKED_TWEETS_ENDPOINT,
      {
        userId: resolvedUserId,
        count: 100,
        includePromotedContent: false,
        withClientEventToken: false,
        withBirdwatchNotes: false,
        withVoice: true,
        withV2Timeline: true,
      },
      { additionalFeatures: true },
    );

    return this.paginate(request, [
      'data',
      'user',
      'result',
      'timeline_v2',
      'timeline',
      'instructions',
    ], options);
  }

  async getLikedPosts(
    userId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    return this.getLikedTweets(userId, options);
  }

  async getUserTimeline(
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    const request = this.generateRequestData(
      X_PATHS.HOME_TIMELINE_ENDPOINT,
      {
        count: 40,
        includePromotedContent: true,
        latestControlAvailable: true,
        withCommunity: true,
      },
      { additionalFeatures: true },
    );

    return this.paginate(request, [
      'data',
      'home',
      'home_timeline_urt',
      'instructions',
    ], options);
  }

  async getListTweets(
    listId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    const request = this.generateRequestData(
      X_PATHS.TWEETS_LIST_ENDPOINT,
      { listId: String(listId), count: 100 },
      { additionalFeatures: true },
    );

    return this.paginate(request, [
      'data',
      'list',
      'tweets_timeline',
      'timeline',
      'instructions',
    ], options);
  }

  async getTopicTweets(
    topicId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    const request = this.generateRequestData(
      X_PATHS.TOPIC_TWEETS_ENDPOINT,
      { rest_id: String(topicId), count: 100 },
      { additionalFeatures: true },
    );

    return this.paginate(request, [
      'data',
      'topic_by_rest_id',
      'topic_page',
      'body',
      'timeline',
      'instructions',
    ], options);
  }

  async getFriends(
    userId: string | number,
    options: PaginationOptions & {
      follower?: boolean;
      following?: boolean;
      mutualFollower?: boolean;
    } = {},
  ): Promise<PaginatedResult> {
    const selectedModes = [
      options.follower,
      options.following,
      options.mutualFollower,
    ].filter(Boolean);

    if (selectedModes.length !== 1) {
      throw new Error('Set exactly one friends timeline mode.');
    }

    await this.requireAuthenticatedSession('friends timelines');

    const endpoint = options.follower
      ? X_PATHS.FOLLOWERS_ENDPOINT
      : options.following
        ? X_PATHS.FOLLOWINGS_ENDPOINT
        : X_PATHS.MUTUAL_FOLLOWERS_ENDPOINT;
    const resolvedUserId = await this.getUserId(userId);
    const request = this.generateRequestData(
      endpoint,
      {
        userId: resolvedUserId,
        count: 100,
        includePromotedContent: false,
      },
      { additionalFeatures: true },
    );

    return this.paginate(request, [
      'data',
      'user',
      'result',
      'timeline',
      'timeline',
      'instructions',
    ], options);
  }

  async getProfileBusinessCategory(userId: string | number): Promise<unknown> {
    const resolvedUserId = await this.getUserId(userId);
    const request = this.generateRequestData(
      X_PATHS.PROFILE_CATEGORY_ENDPOINT,
      { rest_id: resolvedUserId },
    );

    return this.request(request.url, { params: request.params });
  }

  async getTweetLikes(
    tweetId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    const request = this.generateRequestData(
      X_PATHS.TWEET_LIKES_ENDPOINT,
      {
        tweetId: String(tweetId),
        count: 100,
        includePromotedContent: true,
      },
      { additionalFeatures: true },
    );

    return this.paginate(request, [
      'data',
      'favoriters_timeline',
      'timeline',
      'instructions',
    ], options);
  }

  async getPostLikes(
    postId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    return this.getTweetLikes(postId, options);
  }

  async getRetweeters(
    tweetId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    const request = this.generateRequestData(
      X_PATHS.RETWEETED_BY_ENDPOINT,
      {
        tweetId: String(tweetId),
        count: 100,
        includePromotedContent: true,
      },
      { additionalFeatures: true },
    );

    return this.paginate(request, [
      'data',
      'retweeters_timeline',
      'timeline',
      'instructions',
    ], options);
  }

  async getReposters(
    postId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    return this.getRetweeters(postId, options);
  }

  async getUserHighlights(
    userId: string | number,
    options: PaginationOptions = {},
  ): Promise<PaginatedResult> {
    const resolvedUserId = await this.getUserId(userId);
    const request = this.generateRequestData(
      X_PATHS.USER_HIGHLIGHTS_ENDPOINT,
      {
        userId: resolvedUserId,
        count: 100,
        includePromotedContent: true,
        withVoice: true,
      },
      { additionalFeatures: true },
    );

    return this.paginate(request, [
      'data',
      'user',
      'result',
      'timeline',
      'timeline',
      'instructions',
    ], options);
  }

  async login(credentials: LoginCredentials): Promise<void> {
    const requestClient = await this.getRequestClient();
    const handler = new XLoginTaskHandler({ requestClient });
    await handler.login(credentials);
  }

  async saveSession(filePath: string): Promise<string> {
    const requestClient = await this.getRequestClient();
    if (!requestClient.getSessionSnapshot) {
      throw new UnsupportedOperationError(
        'The configured request client does not expose a session snapshot.',
      );
    }

    return saveSessionFile(filePath, requestClient.getSessionSnapshot());
  }

  async loadSession(filePath: string): Promise<XSessionSnapshot> {
    const snapshot = await loadSessionFile(filePath);
    const requestClient = await this.getRequestClient();

    if (!requestClient.restoreSession) {
      throw new UnsupportedOperationError(
        'The configured request client cannot restore a session snapshot.',
      );
    }

    requestClient.restoreSession(snapshot);

    return snapshot;
  }

  async updateApi(pageSource?: string | string[]): Promise<Record<string, string>> {
    const updater = new XApiUpdater();
    const source = pageSource
      ? Array.isArray(pageSource)
        ? pageSource
        : [pageSource]
      : await this.fetchApiUpdateSources(updater);
    const featureSwitches = source[0]
      ? updater.getFeatureSwitches(source[0])
      : {};
    const endpoints = updater.parseApiEndpoints(source);

    this.featureSwitches = featureSwitches;
    this.endpointOverrides = this.mapApiEndpoints(updater, endpoints);

    return this.endpointOverrides;
  }

  private endpointOverrides: Record<string, string> = {};
  private featureSwitches: Record<string, { value: boolean }> = {};

  private async fetchApiUpdateSources(updater: XApiUpdater): Promise<string[]> {
    const requestClient = await this.getRequestClient();
    const updateHeaders = {
      Authorization: undefined,
      'X-Csrf-Token': undefined,
      'X-Guest-Token': undefined,
      'X-Twitter-Auth-Type': undefined,
    };
    const homePage = await requestClient.request(X_PATHS.BASE_URL, {
      headers: updateHeaders,
    });
    const homePageSource = String(homePage.text ?? '');
    const sources = [homePageSource];
    const apiFileUrl = updater.getApiFileUrl(homePageSource);
    const mainFileUrl = updater.getMainFileUrl(homePageSource);

    for (const fileUrl of [apiFileUrl, mainFileUrl]) {
      if (!fileUrl) {
        continue;
      }

      const response = await requestClient.request(fileUrl, {
        headers: updateHeaders,
      });
      sources.push(String(response.text ?? ''));
    }

    return sources;
  }

  private mapApiEndpoints(
    updater: XApiUpdater,
    endpoints: ReturnType<XApiUpdater['parseApiEndpoints']>,
  ): Record<string, string> {
    return updater.mapEndpoints(
      Object.fromEntries(
        Object.entries(X_PATHS).filter(([, value]) => value.includes('/')),
      ),
      endpoints,
    );
  }

  generateRequestData(
    endpoint: string,
    variables?: Record<string, unknown>,
    featureOptions?: FeatureOptions,
  ): { url: string; params: Record<string, string> } {
    const params: Record<string, string> = {};

    if (variables) {
      params.variables = JSON.stringify(variables);
    }

    if (featureOptions) {
      params.features = JSON.stringify(generateFeatures(featureOptions));
    }

    return {
      url: graphqlUrl(this.resolveEndpoint(endpoint)),
      params,
    };
  }

  private resolveEndpoint(endpoint: string): string {
    const endpointKey = Object.entries(X_PATHS).find(
      ([, value]) => value === endpoint,
    )?.[0];

    return endpointKey ? this.endpointOverrides[endpointKey] ?? endpoint : endpoint;
  }

  private async request(
    url: string,
    options?: { params?: Record<string, string> },
  ): Promise<Record<string, unknown>> {
    const requestClient = await this.getRequestClient();
    return requestClient.request(url, options);
  }

  private async paginate(
    request: { url: string; params: Record<string, string> },
    dataPath: string[],
    options: PaginationOptions,
  ): Promise<PaginatedResult> {
    return handleTimelinePagination({
      requestClient: await this.getRequestClient(),
      url: request.url,
      params: request.params,
      dataPath,
      endCursor: options.endCursor,
      total: options.total,
      pagination: options.pagination,
    });
  }

  private async getRequestClient(): Promise<XAdapterRequestClient> {
    if (!this.requestClient && this.autoInit) {
      await this.init();
    }

    if (!this.requestClient) {
      throw new Error('XAdapter has not been initialized.');
    }

    return this.requestClient;
  }

  private async requireAuthenticatedSession(scope: string): Promise<void> {
    const requestClient = await this.getRequestClient();

    if (!requestClient.getSessionSnapshot?.().cookies.auth_token) {
      throw new Error(`X auth token is required for ${scope}.`);
    }
  }
}

function getPath(source: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, source);
}
