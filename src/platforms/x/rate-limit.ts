export interface RateLimitStats {
  total_limit: number;
  remaining_requests_count: number;
  resets_after: string;
  reset_after_datetime_object: number;
  rate_limit_exhausted: boolean;
}

export function parseRateLimit(
  headers: Record<string, string | undefined>,
  now = Date.now(),
): RateLimitStats | undefined {
  const limit = getHeader(headers, 'x-rate-limit-limit');
  const remaining = getHeader(headers, 'x-rate-limit-remaining');
  const reset = getHeader(headers, 'x-rate-limit-reset');

  if (!limit || !remaining || !reset) {
    return undefined;
  }

  const totalLimit = Number.parseInt(limit, 10);
  const remainingRequests = Number.parseInt(remaining, 10);
  const resetTimestamp = Number.parseInt(reset, 10);

  if (
    Number.isNaN(totalLimit) ||
    Number.isNaN(remainingRequests) ||
    Number.isNaN(resetTimestamp)
  ) {
    return undefined;
  }

  const resetAfterSeconds = Math.max(0, resetTimestamp - Math.floor(now / 1000));

  return {
    total_limit: totalLimit,
    remaining_requests_count: remainingRequests,
    resets_after: formatDuration(resetAfterSeconds),
    reset_after_datetime_object: resetAfterSeconds,
    rate_limit_exhausted: remainingRequests === 0,
  };
}

export function getHeader(
  headers: Record<string, string | undefined>,
  name: string,
): string | undefined {
  const normalized = name.toLowerCase();
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === normalized,
  );

  return match?.[1];
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours} Hours, ${minutes} Minutes, ${seconds.toFixed(2)} Seconds`;
}
