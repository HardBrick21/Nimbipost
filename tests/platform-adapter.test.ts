import { describe, expect, it } from 'vitest';
import {
  UnsupportedOperationError,
  XAdapter,
  createPlatformAdapter,
} from '../src/index';

describe('platform adapter factory', () => {
  it('creates the X adapter through the shared factory', () => {
    const adapter = createPlatformAdapter('x', { autoInit: false });

    expect(adapter).toBeInstanceOf(XAdapter);
    expect(adapter.platform).toBe('x');
  });

  it('rejects unsupported platform names', () => {
    expect(() => createPlatformAdapter('unknown' as never)).toThrow(
      UnsupportedOperationError,
    );
  });
});
