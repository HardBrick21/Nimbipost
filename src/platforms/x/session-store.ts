import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface XSessionSnapshot {
  headers: Record<string, string>;
  cookies: Record<string, string>;
}

export async function saveSessionFile(
  filePath: string,
  session: XSessionSnapshot,
): Promise<string> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(session, null, 2)}\n`, 'utf8');

  return filePath;
}

export async function loadSessionFile(
  filePath: string,
): Promise<XSessionSnapshot> {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;

  if (!isSessionSnapshot(raw)) {
    throw new TypeError('Invalid X session file.');
  }

  return raw;
}

function isSessionSnapshot(value: unknown): value is XSessionSnapshot {
  return (
    isRecord(value) &&
    isStringRecord(value.headers) &&
    isStringRecord(value.cookies)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}
