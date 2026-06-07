import type { PaginatedResult } from '../../core/platform-adapter';
import type { XRequestClient } from './request-client';

export interface TimelinePaginationOptions {
  requestClient: Pick<XRequestClient, 'request'>;
  url: string;
  params: Record<string, string>;
  dataPath: string[];
  endCursor?: string;
  total?: number;
  pagination?: boolean;
}

export async function handleTimelinePagination({
  requestClient,
  url,
  params,
  dataPath,
  endCursor,
  total,
  pagination = true,
}: TimelinePaginationOptions): Promise<PaginatedResult> {
  if (!pagination && total !== undefined) {
    throw new Error(
      'pagination cannot be disabled while the total number of results are specified.',
    );
  }

  const dataContainer: PaginatedResult = {
    data: [],
    cursor_endpoint: null,
    has_next_page: true,
    api_rate_limit: undefined,
  };
  const nextParams = { ...params };
  let cursor = endCursor;

  while (dataContainer.has_next_page) {
    if (cursor) {
      const variables = JSON.parse(nextParams.variables ?? '{}') as Record<
        string,
        unknown
      >;
      variables.cursor = cursor;
      nextParams.variables = JSON.stringify(variables);
    }

    const response = await requestClient.request(url, { params: nextParams });
    dataContainer.api_rate_limit = response.api_rate_limit;

    const instructions = getPath(response, dataPath);
    if (!Array.isArray(instructions)) {
      return dataContainer;
    }

    const instruction = instructions.find(
      (item): item is Record<string, unknown> =>
        isRecord(item) && item.type === 'TimelineAddEntries',
    );
    const entries = Array.isArray(instruction?.entries)
      ? instruction.entries
      : [];

    const topCursor = entries.find((entry: unknown) =>
      String(isRecord(entry) ? entry.entryId ?? '' : '').startsWith('cursor-top'),
    );
    const bottomCursor = entries.find((entry: unknown) =>
      String(isRecord(entry) ? entry.entryId ?? '' : '').startsWith(
        'cursor-bottom',
      ),
    );
    const bottomCursorValue = getCursorValue(bottomCursor);
    const filtered = filterTimelineEntries(
      entries,
      total === undefined ? undefined : total - dataContainer.data.length,
    );

    dataContainer.data.push(...filtered);

    if (bottomCursorValue) {
      cursor = bottomCursorValue;
      dataContainer.cursor_endpoint = bottomCursorValue;
    }

    const cursorOnlyPage =
      ((topCursor && bottomCursor) && entries.length === 2) ||
      ((topCursor || bottomCursor) && entries.length === 1) ||
      !bottomCursorValue;

    if (
      cursorOnlyPage ||
      !pagination ||
      (total !== undefined && dataContainer.data.length >= total)
    ) {
      dataContainer.has_next_page = Boolean(
        bottomCursorValue && !cursorOnlyPage,
      );
      return dataContainer;
    }
  }

  return dataContainer;
}

export function getPath(source: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, source);
}

function filterTimelineEntries(entries: unknown[], limit?: number): unknown[] {
  const filtered = entries.filter((entry) => {
    const entryId = String(isRecord(entry) ? entry.entryId ?? '' : '');
    return !entryId.startsWith('cursor-top') && !entryId.startsWith('cursor-bottom');
  });

  return limit === undefined ? filtered : filtered.slice(0, Math.max(0, limit));
}

function getCursorValue(entry: unknown): string | undefined {
  if (!isRecord(entry)) {
    return undefined;
  }

  const content = entry.content;
  if (!isRecord(content)) {
    return undefined;
  }

  if (typeof content.value === 'string') {
    return content.value;
  }

  const itemContent = content.itemContent;
  if (isRecord(itemContent)) {
    const value = itemContent.value;
    return typeof value === 'string' ? value : undefined;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
