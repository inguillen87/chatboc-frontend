import { BASE_API_URL } from '@/config';
import { apiFetch } from './api';
import { withBackendReadTimeout } from './backendReadTimeout';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from './chatbocSessionRevision';
import { panelReadOptions } from './panelReadOptions';

export interface PrivateBackendReadLifecycle {
  isCurrent?: () => boolean;
}

/** Used only by private GET contracts: startup and public presentation cannot replace panel authority. */
export const privateBackendRead = async (
  path: string,
  tenantSlug?: string | null,
  lifecycle: PrivateBackendReadLifecycle = {},
): Promise<unknown> => {
  const sessionRevision = captureChatbocSessionRevision();
  const isCurrent = () => isChatbocSessionRevisionCurrent(sessionRevision)
    && lifecycle.isCurrent?.() !== false;
  const payload = await withBackendReadTimeout(
    () => apiFetch<unknown>(path, { ...panelReadOptions(tenantSlug), cache: 'no-store', isCurrent }),
    8_000,
    'Private configuration read',
    BASE_API_URL,
    isCurrent,
  );
  if (!isCurrent()) throw new DOMException('Private read scope expired', 'AbortError');
  return payload;
};
