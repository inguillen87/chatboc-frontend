import { ensureBackendRuntimeReady } from './backendBootstrapGate';
import { STARTUP_CONTINUITY_BUDGET_MS } from './backendRequestContinuity';
import { withAsyncTimeout } from './asyncTimeout';

/** Readiness has its own bounded budget; it must not consume the screen's read deadline. */
export const withBackendReadTimeout = async <T>(
  read: () => Promise<T>,
  responseTimeoutMs: number,
  operationName: string,
  baseUrl: string,
  isCurrent: () => boolean = () => true,
): Promise<T> => {
  if (!isCurrent()) throw new Error('Private read scope expired');
  await ensureBackendRuntimeReady({ baseUrl });
  if (!isCurrent()) throw new Error('Private read scope expired');
  return withAsyncTimeout(
    read(),
    STARTUP_CONTINUITY_BUDGET_MS + responseTimeoutMs,
    operationName,
  );
};
