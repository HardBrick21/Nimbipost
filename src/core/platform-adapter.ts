export type PlatformName =
  | 'x'
  | 'bluesky'
  | 'mastodon'
  | 'reddit'
  | 'youtube'
  | 'tiktok'
  | 'telegram'
  | 'threads'
  | 'instagram';

export interface PaginationOptions {
  endCursor?: string;
  total?: number;
  pagination?: boolean;
}

export interface PaginatedResult<T = unknown> {
  data: T[];
  cursor_endpoint: string | null;
  has_next_page: boolean;
  api_rate_limit?: unknown;
}

export interface FollowingTimelineOptions extends PaginationOptions {
  enableRanking?: boolean;
  since?: Date | string;
  until?: Date | string;
}

export interface PlatformAdapter {
  readonly platform: PlatformName;
  init(): Promise<void>;
  generateSession?(options?: unknown): Promise<unknown>;
  loggedIn?(): boolean;
  login?(credentials: unknown): Promise<void>;
  saveSession?(filePath: string): Promise<string>;
  loadSession?(filePath: string): Promise<unknown>;
  updateApi?(source?: unknown): Promise<unknown>;
  getMe?(): Promise<unknown>;
  getUserId(username: string | number): Promise<string>;
  getUserData(username: string): Promise<unknown>;
  getUserInfo(userId: string | number): Promise<unknown>;
  getUserPosts(
    userId: string | number,
    options?: PaginationOptions & { withReplies?: boolean },
  ): Promise<PaginatedResult>;
  getPost(
    postId: string | number,
    options?: PaginationOptions & { withTweetReplies?: boolean },
  ): Promise<unknown>;
  search(
    query: string,
    options?: PaginationOptions & { searchFilter?: string },
  ): Promise<PaginatedResult>;
  getMultipleUsersData?(userIds: Array<string | number>): Promise<unknown>;
  getUserMedia?(
    userId: string | number,
    options?: PaginationOptions,
  ): Promise<PaginatedResult>;
  getLikedPosts?(
    userId: string | number,
    options?: PaginationOptions,
  ): Promise<PaginatedResult>;
  getUserTimeline?(options?: PaginationOptions): Promise<PaginatedResult>;
  getFollowingTimeline?(
    options?: FollowingTimelineOptions,
  ): Promise<PaginatedResult>;
  getListTweets?(
    listId: string | number,
    options?: PaginationOptions,
  ): Promise<PaginatedResult>;
  getTopicTweets?(
    topicId: string | number,
    options?: PaginationOptions,
  ): Promise<PaginatedResult>;
  getFriends?(
    userId: string | number,
    options?: PaginationOptions & {
      follower?: boolean;
      following?: boolean;
      mutualFollower?: boolean;
    },
  ): Promise<PaginatedResult>;
  getProfileBusinessCategory?(userId: string | number): Promise<unknown>;
  getPostLikes?(
    postId: string | number,
    options?: PaginationOptions,
  ): Promise<PaginatedResult>;
  getReposters?(
    postId: string | number,
    options?: PaginationOptions,
  ): Promise<PaginatedResult>;
  getUserHighlights?(
    userId: string | number,
    options?: PaginationOptions,
  ): Promise<PaginatedResult>;
  getUserTweets?(
    userId: string | number,
    options?: PaginationOptions & { withReplies?: boolean },
  ): Promise<PaginatedResult>;
  getTweet?(
    tweetId: string | number,
    options?: PaginationOptions & { withTweetReplies?: boolean },
  ): Promise<unknown>;
  getLikedTweets?(
    userId: string | number,
    options?: PaginationOptions,
  ): Promise<PaginatedResult>;
  getTweetLikes?(
    tweetId: string | number,
    options?: PaginationOptions,
  ): Promise<PaginatedResult>;
  getRetweeters?(
    tweetId: string | number,
    options?: PaginationOptions,
  ): Promise<PaginatedResult>;
}
