export class AsyncOperationTimeoutError extends Error {
  readonly code = 'ASYNC_OPERATION_TIMEOUT';
  readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms`);
    this.name = 'AsyncOperationTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export const withAsyncTimeout = <T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName = 'Async operation',
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new AsyncOperationTimeoutError(operationName, timeoutMs)),
      timeoutMs,
    );
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
};
