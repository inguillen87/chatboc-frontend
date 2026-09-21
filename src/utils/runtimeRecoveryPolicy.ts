import { isDisabilityAIAgentDemoPath } from '@/config/publicPresentationRoutes';

/** Read-only recovery is independent from the pre-mount startup gate.
 * An offline hint must not prevent an explicit check of the same-origin API.
 */
export function isRuntimeRecoveryEnabled(): boolean {
  if (typeof window === 'undefined' || isDisabilityAIAgentDemoPath(window.location.pathname)) return false;
  const configured = import.meta.env.VITE_RUNTIME_RECOVERY_ENABLED;
  if (configured === undefined) return true;
  return typeof configured === 'string' && ['1', 'true', 'yes', 'on'].includes(configured.trim().toLowerCase());
}
