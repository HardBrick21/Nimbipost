import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { XAdapter } from '../../src/platforms/x/adapter';
import { XRequestClient } from '../../src/platforms/x/request-client';
import { loadSessionFile, saveSessionFile } from '../../src/platforms/x/session-store';

describe('X session persistence', () => {
  it('saves and loads session headers and cookies as JSON', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nimbipost-session-'));
    const filePath = join(directory, 'elonmusk.json');

    try {
      await saveSessionFile(filePath, {
        headers: { Authorization: 'Bearer token', 'X-Guest-Token': 'guest' },
        cookies: { auth_token: 'auth', ct0: 'csrf' },
      });

      const raw = JSON.parse(await readFile(filePath, 'utf8'));
      expect(raw).toEqual({
        headers: { Authorization: 'Bearer token', 'X-Guest-Token': 'guest' },
        cookies: { auth_token: 'auth', ct0: 'csrf' },
      });

      await expect(loadSessionFile(filePath)).resolves.toEqual(raw);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('restores a saved session into an adapter request client', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nimbipost-session-'));
    const filePath = join(directory, 'session.json');
    const requestClient = new XRequestClient();
    const adapter = new XAdapter({
      autoInit: false,
      requestClient,
    });

    try {
      await saveSessionFile(filePath, {
        headers: { Authorization: 'Bearer token' },
        cookies: { auth_token: 'auth', ct0: 'csrf' },
      });

      await adapter.loadSession(filePath);

      expect(requestClient.getSessionSnapshot()).toEqual({
        headers: { Authorization: 'Bearer token' },
        cookies: { auth_token: 'auth', ct0: 'csrf' },
      });
      expect(adapter.loggedIn()).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('applies auth tokens as cookies when constructing an adapter', async () => {
    const requestClient = new XRequestClient();
    const adapter = new XAdapter({
      autoInit: false,
      authToken: 'auth-token',
      requestClient,
    });

    await adapter.generateSession({ authToken: 'auth-token' });

    expect(requestClient.getSessionSnapshot().cookies).toEqual({
      auth_token: 'auth-token',
    });
    expect(adapter.loggedIn()).toBe(true);
  });
});
