import { X_PATHS } from './endpoints';

export type NestedKey = string | string[];

const USER_FIELDS = [
  'can_dm',
  'created_at',
  'creator_subscriptions_count',
  'default_profile',
  'default_profile_image',
  'description',
  'favourites_count',
  'followers_count',
  'friends_count',
  'has_custom_timelines',
  'has_graduated_access',
  'id',
  'is_blue_verified',
  'is_profile_translatable',
  'is_translator',
  'listed_count',
  'location',
  'media_count',
  'name',
  'pinned_tweet_ids_str',
  'possibly_sensitive',
  'professional_type',
  'profile_banner_url',
  'profile_image_shape',
  'profile_image_url_https',
  'profile_interstitial_type',
  'rest_id',
  'screen_name',
  'statuses_count',
  'translator_type',
  'url',
  'verification_info',
  'verified',
  'verified_phone_status',
  'verified_type',
  'withheld_in_countries',
] as const;

const TWEET_FIELDS = [
  'bookmark_count',
  'bookmarked',
  'conversation_id_str',
  'created_at',
  'favorite_count',
  'favorited',
  'full_text',
  'hashtags',
  'id_str',
  'in_reply_to_screen_name',
  'in_reply_to_status_id_str',
  'in_reply_to_user_id_str',
  'is_quote_status',
  'is_translatable',
  'lang',
  'possibly_sensitive',
  'possibly_sensitive_editable',
  'quote_count',
  'reply_count',
  'rest_id',
  'retweet_count',
  'retweeted',
  'source',
  'user_id_str',
  'user_mentions',
  'views',
] as const;

export function findNestedKey(
  dataset: unknown,
  nestedKey: NestedKey | NestedKey[],
): unknown {
  if (Array.isArray(nestedKey) && isKeyList(nestedKey)) {
    if (Array.isArray(dataset)) {
      return dataset.map((item) => mapKeyList(item, nestedKey));
    }

    return mapKeyList(dataset, nestedKey);
  }

  if (Array.isArray(dataset)) {
    return dataset.map((item) => findNestedValue(item, nestedKey));
  }

  return findNestedValue(dataset, nestedKey);
}

export class User {
  private data: Record<string, unknown>;

  constructor(dataset: unknown) {
    const userResult = findNestedKey(dataset, ['user_results', 'result']);
    const source = isRecord(userResult) ? userResult : dataset;
    const legacy = findNestedKey(source, 'legacy');
    this.data = {};

    if (isRecord(legacy)) {
      assignFields(this.data, legacy, USER_FIELDS, ['id', 'rest_id', 'description', 'url']);
    }

    if (isRecord(source)) {
      assignFields(this.data, source, USER_FIELDS, ['id', 'rest_id', 'description', 'url']);
    }

    this.data.urls = findNestedKey(source, ['entities', 'url', 'urls']) ?? [];
    this.data.description_urls =
      findNestedKey(source, ['entities', 'description', 'urls']) ?? [];

    if (this.data.screen_name) {
      this.data.profile_url = `${X_PATHS.BASE_URL}${String(this.data.screen_name)}`;
    }
  }

  toJSON(): Record<string, unknown> {
    return { ...this.data };
  }

  dict(): Record<string, unknown> {
    return this.toJSON();
  }
}

export class Tweet {
  private data: Record<string, unknown>;

  constructor(dataset: unknown) {
    const statusResult = findNestedKey(dataset, ['tweetResult', 'result']);
    const resultPath = hasFoundValue(statusResult)
      ? ['tweetResult', 'result']
      : ['tweet_results', 'result'];
    const result = findNestedKey(dataset, resultPath);
    const legacy = findNestedKey(dataset, [...resultPath, 'legacy']);
    this.data = {};

    if (isRecord(legacy)) {
      assignFields(this.data, legacy, TWEET_FIELDS, [
        'id_str',
        'rest_id',
        'source',
        'is_translatable',
        'possibly_sensitive',
        'views',
        'created_at',
      ]);
    }

    if (isRecord(result)) {
      assignFields(this.data, result, TWEET_FIELDS, [
        'id_str',
        'rest_id',
        'source',
        'is_translatable',
        'possibly_sensitive',
        'views',
        'created_at',
      ]);
    }

    assignIfFound(this.data, 'screen_name', findNestedKey(result, [
      'core',
      'user_results',
      'result',
      'legacy',
      'screen_name',
    ]));
    assignIfFound(this.data, 'name', findNestedKey(result, [
      'core',
      'user_results',
      'result',
      'legacy',
      'name',
    ]));

    if (this.data.screen_name && this.data.rest_id) {
      this.data.tweet_url = `${X_PATHS.BASE_URL}${String(this.data.screen_name)}/status/${String(this.data.rest_id)}`;
    }

    if (this.data.in_reply_to_screen_name && this.data.in_reply_to_status_id_str) {
      this.data.original_tweet = `${X_PATHS.BASE_URL}${String(this.data.in_reply_to_screen_name)}/status/${String(this.data.in_reply_to_status_id_str)}`;
    }
  }

  toJSON(): Record<string, unknown> {
    return { ...this.data };
  }

  dict(): Record<string, unknown> {
    return this.toJSON();
  }
}

function mapKeyList(dataset: unknown, keys: NestedKey[]): Record<string, unknown> {
  return Object.fromEntries(
    keys.map((key) => [Array.isArray(key) ? key.join('.') : key, findNestedValue(dataset, key)]),
  );
}

function isKeyList(value: unknown[]): value is NestedKey[] {
  return (
    value.some((item) => Array.isArray(item)) &&
    value.every((item) => typeof item === 'string' || Array.isArray(item))
  );
}

function findNestedValue(dataset: unknown, nestedKey: NestedKey): unknown {
  const matches: unknown[] = [];
  collectNestedValues(dataset, nestedKey, matches);

  if (matches.length === 1) {
    return matches[0];
  }

  return matches;
}

function collectNestedValues(
  dataset: unknown,
  nestedKey: NestedKey,
  matches: unknown[],
): void {
  if (Array.isArray(dataset)) {
    for (const item of dataset) {
      collectNestedValues(item, nestedKey, matches);
    }
    return;
  }

  if (!isRecord(dataset)) {
    return;
  }

  if (Array.isArray(nestedKey) && nestedKey[0] in dataset) {
    const value = nestedKey.reduce<unknown>((current, key) => {
      if (isRecord(current)) {
        return current[key];
      }

      return undefined;
    }, dataset);

    if (value !== undefined && value !== null) {
      matches.push(value);
    }
  }

  if (typeof nestedKey === 'string' && nestedKey in dataset) {
    matches.push(dataset[nestedKey]);
  }

  for (const value of Object.values(dataset)) {
    collectNestedValues(value, nestedKey, matches);
  }
}

function assignFields(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  fields: readonly string[],
  directFields: readonly string[],
): void {
  for (const field of fields) {
    const value = directFields.includes(field)
      ? source[field]
      : findNestedKey(source, field);

    assignIfFound(target, field, value);
  }
}

function assignIfFound(
  target: Record<string, unknown>,
  field: string,
  value: unknown,
): void {
  if (hasFoundValue(value)) {
    target[field] = value;
  }
}

function hasFoundValue(value: unknown): boolean {
  return value !== undefined && (!Array.isArray(value) || value.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
