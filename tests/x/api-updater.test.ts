import { describe, expect, it } from 'vitest';
import { XApiUpdater } from '../../src/platforms/x/api-updater';
import { XAdapter } from '../../src/platforms/x/adapter';

describe('XApiUpdater', () => {
  it('extracts API and main bundle URLs from the home page source', () => {
    const updater = new XApiUpdater();
    const pageSource = '..."api": "abc123", ..."main.def456.js"...';

    expect(updater.getApiFileUrl(pageSource)).toBe(
      'https://abs.twimg.com/responsive-web/client-web/api.abc123a.js',
    );
    expect(updater.getMainFileUrl(pageSource)).toBe(
      'https://abs.twimg.com/responsive-web/client-web/main.def456.js',
    );
  });

  it('parses query metadata and maps existing endpoints by operation name', () => {
    const updater = new XApiUpdater();
    const bundle = `
      exports={queryId:"new-user",operationName:"UserByScreenName",metadata:{featureSwitches:["responsive_web_graphql_timeline_navigation_enabled"]}},
      exports={queryId:"new-tweet",operationName:"TweetDetail",metadata:{featureSwitches:[]}},
    `;

    const endpoints = updater.parseApiEndpoints(bundle);

    expect(updater.mapEndpoints({ USER_DATA_ENDPOINT: 'old/UserByScreenName' }, endpoints)).toEqual({
      USER_DATA_ENDPOINT: 'new-user/UserByScreenName',
    });
  });

  it('parses live-style exports with nested metadata objects', () => {
    const updater = new XApiUpdater();
    const bundle =
      'exports={"queryId":"D1nwFlsu_qHsX92YzoRaaA","operationName":"AddContentDisclosure","operationType":"mutation","metadata":{"featureSwitches":[],"fieldToggles":[]}},exports={"queryId":"abc","operationName":"UserByScreenName","metadata":{"featureSwitches":["a"]}},';

    expect(updater.parseApiEndpoints(bundle)).toEqual([
      {
        queryId: 'D1nwFlsu_qHsX92YzoRaaA',
        operationName: 'AddContentDisclosure',
        operationType: 'mutation',
        metadata: { featureSwitches: [], fieldToggles: [] },
      },
      {
        queryId: 'abc',
        operationName: 'UserByScreenName',
        metadata: { featureSwitches: ['a'] },
      },
    ]);
  });

  it('ignores wrapper braces after a balanced export object', () => {
    const updater = new XApiUpdater();
    const bundle =
      'exports={"queryId":"D1nwFlsu_qHsX92YzoRaaA","operationName":"AddContentDisclosure","operationType":"mutation","metadata":{"featureSwitches":[],"fieldToggles":[]}}},';

    expect(updater.parseApiEndpoints(bundle)).toEqual([
      {
        queryId: 'D1nwFlsu_qHsX92YzoRaaA',
        operationName: 'AddContentDisclosure',
        operationType: 'mutation',
        metadata: { featureSwitches: [], fieldToggles: [] },
      },
    ]);
  });

  it('extracts feature switch defaults from page source', () => {
    const updater = new XApiUpdater();
    const pageSource =
      '..."featureSwitch":{"defaultConfig":{"feature_a":{"value":true},"feature_b":{"value":false}}},...';

    expect(updater.getFeatureSwitches(pageSource)).toEqual({
      feature_a: { value: true },
      feature_b: { value: false },
    });
  });

  it('updates adapter endpoints from fetched home and bundle sources', async () => {
    const requests: Array<{
      url: string;
      headers?: Record<string, string | undefined>;
    }> = [];
    const responses = [
      {
        text:
          '"api":"abc123","main.def456.js","featureSwitch":{"defaultConfig":{"responsive_web_graphql_timeline_navigation_enabled":{"value":true}}}',
      },
      {
        text:
          'exports={queryId:"new-user",operationName:"UserByScreenName",metadata:{featureSwitches:["responsive_web_graphql_timeline_navigation_enabled"]}},',
      },
      {
        text:
          'exports={queryId:"new-tweet",operationName:"TweetDetail",metadata:{featureSwitches:[]}},',
      },
    ];
    const adapter = new XAdapter({
      autoInit: false,
      requestClient: {
        async request(
          url: string,
          options?: { headers?: Record<string, string | undefined> },
        ) {
          requests.push({ url, headers: options?.headers });
          const response = responses.shift();
          if (!response) {
            throw new Error('No fake response configured');
          }

          return response;
        },
      },
    });

    const mapped = await adapter.updateApi();

    expect(requests.map((request) => request.url)).toEqual([
      'https://x.com/',
      'https://abs.twimg.com/responsive-web/client-web/api.abc123a.js',
      'https://abs.twimg.com/responsive-web/client-web/main.def456.js',
    ]);
    expect(requests.map((request) => request.headers)).toEqual([
      {
        Authorization: undefined,
        'X-Csrf-Token': undefined,
        'X-Guest-Token': undefined,
        'X-Twitter-Auth-Type': undefined,
      },
      {
        Authorization: undefined,
        'X-Csrf-Token': undefined,
        'X-Guest-Token': undefined,
        'X-Twitter-Auth-Type': undefined,
      },
      {
        Authorization: undefined,
        'X-Csrf-Token': undefined,
        'X-Guest-Token': undefined,
        'X-Twitter-Auth-Type': undefined,
      },
    ]);
    expect(mapped).toMatchObject({
      USER_DATA_ENDPOINT: 'new-user/UserByScreenName',
      TWEET_DETAILS_ENDPOINT: 'new-tweet/TweetDetail',
    });
  });
});
