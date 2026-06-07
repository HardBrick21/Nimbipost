import { describe, expect, it } from 'vitest';
import { XAdapter } from '../src/platforms/x/adapter';

function createXAdapter(responses: Array<Record<string, unknown>>) {
  const requests: Array<{ url: string; params?: Record<string, string> }> = [];
  const adapter = new XAdapter({
    autoInit: false,
    requestClient: {
      async request(url: string, options?: { params?: Record<string, string> }) {
        requests.push({ url, params: options?.params });
        const response = responses.shift();
        if (!response) {
          throw new Error('No fake response configured');
        }

        return response;
      },
    },
  });

  return { adapter, requests };
}

describe('generic platform adapter names', () => {
  it('keeps X aliases while exposing generic post methods', async () => {
    const { adapter } = createXAdapter([
      { data: { user: { result: { rest_id: '44196397' } } } },
      {
        data: {
          user: {
            result: {
              timeline: {
                timeline: {
                  instructions: [
                    {
                      type: 'TimelineAddEntries',
                      entries: [
                        { entryId: 'tweet-1', content: { itemContent: { id: '1' } } },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]);

    const posts = await adapter.getUserPosts('elonmusk', {
      pagination: false,
    });

    expect(posts.data).toEqual([
      { entryId: 'tweet-1', content: { itemContent: { id: '1' } } },
    ]);
  });

  it('maps generic post lookup to the X tweet lookup', async () => {
    const { adapter, requests } = createXAdapter([
      { data: { threaded_conversation_with_injections_v2: {} } },
    ]);

    await adapter.getPost('123');

    expect(requests[0].url).toContain('/TweetDetail');
  });
});
