import { describe, expect, it } from 'vitest';
import { graphqlUrl } from '../../src/platforms/x/endpoints';

describe('X endpoints', () => {
  it('builds GraphQL URLs through the current X web API path', () => {
    expect(graphqlUrl('U96721pgL7wU5QUwu2goUA/Following')).toBe(
      'https://x.com/i/api/graphql/U96721pgL7wU5QUwu2goUA/Following',
    );
  });
});
