/**
 * Retry utility with exponential backoff
 * Used for S3 operations and other network requests that may temporarily fail
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Execute an async operation with exponential backoff retry logic
 *
 * @param operation - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws The last error if all retries are exhausted
 *
 * @example
 * const result = await retryWithBackoff(
 *   async () => s3Client.send(command),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * delay * 0.1;
      const totalDelay = delay + jitter;

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      console.warn(
        `⚠️  Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(totalDelay)}ms: ${lastError.message}`
      );

      // Wait before retrying
      await sleep(totalDelay);
    }
  }

  throw lastError!;
}

/**
 * Sleep for a specified number of milliseconds
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (network/timeout errors)
 * @param error - Error to check
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const retryableCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'RequestTimeout',
    'ServiceUnavailable',
    'SlowDown',
    'TooManyRequests',
  ];

  return (
    retryableCodes.includes(error.code) ||
    retryableCodes.includes(error.name) ||
    (error.$metadata?.httpStatusCode && error.$metadata.httpStatusCode >= 500)
  );
}
