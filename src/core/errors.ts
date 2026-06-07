export class UnsupportedOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedOperationError';
  }
}

export class RateLimitError extends Error {
  constructor(message = 'API rate limit exceeded.') {
    super(message);
    this.name = 'RateLimitError';
  }
}
