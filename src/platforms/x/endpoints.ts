export const X_PATHS = {
  DOMAIN: 'x.com',
  BASE_URL: 'https://x.com/',
  API_URL: 'https://x.com/i/api/graphql/',
  TWITTER_CDN: 'https://abs.twimg.com/responsive-web/client-web',
  TASK_URL: 'https://api.x.com/1.1/onboarding/task.json',
  JAVSCRIPT_INSTRUMENTATION_URL: 'https://twitter.com/i/js_inst',
  GUEST_TOKEN_URL: 'https://api.x.com/1.1/guest/activate.json',
  USER_ID_ENDPOINT: '9zwVLJ48lmVUk8u_Gh9DmA/ProfileSpotlightsQuery',
  USER_INFO_ENDPOINT: 'VQfQ9wwYdk6j_u2O4vt64Q/UserByRestId',
  USER_DATA_ENDPOINT: 'IGgvgiOx4QZndDHuD3x9TQ/UserByScreenName',
  MULTIPLE_USERS_DATA_ENDPOINT: 'a74irv24XPYDjy5LSNQUXg/UsersByRestIds',
  USER_MEDIA_ENDPOINT: '7eisAD00KWfvFW_n5HYL1A/UserMedia',
  USER_TWEETS_ENDPOINT: '54_zVtVXJlQtnIBrY2QSXQ/UserTweets',
  USER_TWEETS_AND_REPLIES_ENDPOINT:
    'xdqXQQg4vOBF9Np6VtUsdw/UserTweetsAndReplies',
  HOME_TIMELINE_ENDPOINT: 'JiwGbpAMYewh2bLC2j1guQ/HomeTimeline',
  TWEETS_LIST_ENDPOINT: 'R36US0qG-bOk3ryAYswZmA/ListLatestTweetsTimeline',
  TOPIC_TWEETS_ENDPOINT: 'KDCkc4PZY-sCy_L-scQImw/TopicLandingPage',
  TWEET_DETAILS_ENDPOINT: 'RguQ9yvaXf-EETmDagsLzg/TweetDetail',
  TWEET_DETAILS_BY_ID: 'SgZWKwvBiOKrSC0QeOGvXw/TweetResultByRestId',
  SEARCH_ENDPOINT: 'dsWn-Op2S0SmJjgY6Yvckg/SearchTimeline',
  FOLLOWERS_ENDPOINT: 'G1uS7V_A_IqHhF9Il0K-nA/Followers',
  FOLLOWINGS_ENDPOINT: 'U96721pgL7wU5QUwu2goUA/Following',
  MUTUAL_FOLLOWERS_ENDPOINT: 'FmuBidUe0SI0YSHvq2T_ZA/FollowersYouKnow',
  LIKED_TWEETS_ENDPOINT: 'QWLtYLOcZidu0RyjeTfd-Q/Likes',
  PROFILE_CATEGORY_ENDPOINT: '6OFpJ3TH3p8JpwOSgfgyhg/BizProfileFetchUser',
  TWEET_LIKES_ENDPOINT: 'mpMee2WCjo7Nm4gRRHHnvA/Favoriters',
  RETWEETED_BY_ENDPOINT: '7Fwe5A6kE05QIybims116A/Retweeters',
  USER_HIGHLIGHTS_ENDPOINT: '0MBHz4yH7wNDyqtCWXNMPQ/UserHighlightsTweets',
  VIEWER_ENDPOINT: '_8ClT24oZ8tpylf_OSuNdg/Viewer',
} as const;

export function graphqlUrl(endpoint: string): string {
  return new URL(endpoint, X_PATHS.API_URL).toString();
}
