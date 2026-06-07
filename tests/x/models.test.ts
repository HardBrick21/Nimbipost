import { describe, expect, it } from 'vitest';
import { Tweet, User, findNestedKey } from '../../src/platforms/x/models';

describe('TweeterPy data helpers', () => {
  it('finds nested keys by string, path tuple, and list of keys', () => {
    const dataset = {
      user: {
        legacy: {
          name: 'Elon Musk',
          screen_name: 'elonmusk',
        },
      },
      tweet: {
        legacy: {
          full_text: 'hello',
        },
      },
    };

    expect(findNestedKey(dataset, 'screen_name')).toBe('elonmusk');
    expect(findNestedKey(dataset, ['legacy', 'full_text'])).toBe('hello');
    expect(findNestedKey(dataset, ['screen_name', ['legacy', 'name']])).toEqual({
      screen_name: 'elonmusk',
      'legacy.name': 'Elon Musk',
    });
  });

  it('normalizes user records like TweeterPy User', () => {
    const user = new User({
      user_results: {
        result: {
          rest_id: '44196397',
          is_blue_verified: true,
          legacy: {
            id: '44196397',
            name: 'Elon Musk',
            screen_name: 'elonmusk',
            description: 'Mars',
            followers_count: 1,
            entities: {
              description: {
                urls: [{ expanded_url: 'https://x.com' }],
              },
            },
          },
        },
      },
    });

    expect(user.toJSON()).toMatchObject({
      id: '44196397',
      rest_id: '44196397',
      name: 'Elon Musk',
      screen_name: 'elonmusk',
      description: 'Mars',
      followers_count: 1,
      is_blue_verified: true,
      profile_url: 'https://x.com/elonmusk',
      description_urls: [{ expanded_url: 'https://x.com' }],
    });
  });

  it('normalizes tweet records like TweeterPy Tweet', () => {
    const tweet = new Tweet({
      content: {
        itemContent: {
          tweet_results: {
            result: {
              rest_id: '123',
              views: { count: '10' },
              core: {
                user_results: {
                  result: {
                    legacy: {
                      name: 'Elon Musk',
                      screen_name: 'elonmusk',
                    },
                  },
                },
              },
              legacy: {
                id_str: '123',
                full_text: 'hello',
                in_reply_to_screen_name: 'nasa',
                in_reply_to_status_id_str: '456',
              },
            },
          },
        },
      },
    });

    expect(tweet.toJSON()).toMatchObject({
      id_str: '123',
      rest_id: '123',
      full_text: 'hello',
      screen_name: 'elonmusk',
      name: 'Elon Musk',
      views: { count: '10' },
      tweet_url: 'https://x.com/elonmusk/status/123',
      original_tweet: 'https://x.com/nasa/status/456',
    });
  });
});
