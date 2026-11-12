import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAssignableAgentsMock = vi.fn();

vi.mock('@/services/ticketService', () => ({
  getAssignableAgents: (...args: unknown[]) => getAssignableAgentsMock(...args),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

import useAssignableAgents, { __resetAssignableAgentsCacheForTests } from './useAssignableAgents';

describe('useAssignableAgents runtime cache', () => {
  beforeEach(() => {
    __resetAssignableAgentsCacheForTests();
    getAssignableAgentsMock.mockReset().mockResolvedValue([
      { id: 10, nombre_usuario: 'Operadora Junín' },
    ]);
  });

  it('reuses the tenant-scoped agent list after a child remount', async () => {
    const first = renderHook(() => useAssignableAgents('municipio'));
    await waitFor(() => expect(first.result.current.agents).toHaveLength(1));
    first.unmount();

    const second = renderHook(() => useAssignableAgents('municipio'));
    await waitFor(() => expect(second.result.current.agents).toHaveLength(1));

    expect(getAssignableAgentsMock).toHaveBeenCalledTimes(1);
    expect(second.result.current.loading).toBe(false);
  });
});
