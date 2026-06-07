export interface FeatureOptions {
  defaultFeatures?: boolean;
  userDataFeatures?: boolean;
  userInfoFeatures?: boolean;
  additionalFeatures?: boolean;
}

export function generateFeatures(options: FeatureOptions = {}) {
  const {
    defaultFeatures = true,
    userDataFeatures = false,
    userInfoFeatures = false,
    additionalFeatures = false,
  } = options;
  const features: Record<string, boolean> = {};

  if (defaultFeatures) {
    Object.assign(features, {
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
    });
  }

  if (userDataFeatures || userInfoFeatures) {
    Object.assign(features, {
      hidden_profile_likes_enabled: false,
      hidden_profile_subscriptions_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      responsive_web_twitter_article_notes_tab_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
    });
  }

  if (userInfoFeatures) {
    Object.assign(features, {
      subscriptions_verification_info_is_identity_verified_enabled: true,
      subscriptions_verification_info_verified_since_enabled: true,
    });
  }

  if (additionalFeatures) {
    Object.assign(features, {
      rweb_lists_timeline_redesign_enabled: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      tweetypie_unmention_optimization_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: false,
      tweet_awards_web_tipping_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
        false,
      rweb_video_timestamps_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: false,
      responsive_web_media_download_video_enabled: false,
      responsive_web_enhance_cards_enabled: false,
    });
  }

  return features;
}
