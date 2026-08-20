import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (payload: unknown) => void>(),
  socket: {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      harness.handlers.set(event, handler);
    }),
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      if (harness.handlers.get(event) === handler) harness.handlers.delete(event);
    }),
  },
}));

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: harness.socket }),
}));

vi.mock('@/hooks/useTicketRealtime', () => ({
  default: () => undefined,
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

import useTicketUpdates from './useTicketUpdates';

describe('useTicketUpdates tenant invalidation contract', () => {
  beforeEach(() => {
    harness.handlers.clear();
    harness.socket.on.mockClear();
    harness.socket.off.mockClear();
  });

  it('routes opaque collection invalidation to a silent refetch callback', () => {
    const onNewTicket = vi.fn();
    const onCollectionInvalidated = vi.fn();

    renderHook(() => useTicketUpdates({ onNewTicket, onCollectionInvalidated }));
    const handleTicketUpdate = harness.handlers.get('ticket_update');
    expect(handleTicketUpdate).toBeTypeOf('function');

    const invalidation = {
      contract_version: 'tickets.collection.invalidated.v1',
      resource: 'tickets',
      reason: 'collection_changed',
      refetch: true,
    };
    act(() => handleTicketUpdate?.(invalidation));

    expect(onCollectionInvalidated).toHaveBeenCalledWith(invalidation);
    expect(onNewTicket).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'non-canonical reason alias',
      payload: {
        contract_version: 'tickets.collection.invalidated.v1',
        resource: 'tickets',
        reason: 'conversation_changed',
        refetch: true,
      },
    },
    {
      label: 'payload with forbidden ticket metadata',
      payload: {
        contract_version: 'tickets.collection.invalidated.v1',
        resource: 'tickets',
        reason: 'collection_changed',
        refetch: true,
        ticket_id: 77,
        actor_email: 'private@example.invalid',
      },
    },
  ])('drops malformed invalidation: $label', ({ payload }) => {
    const onNewTicket = vi.fn();
    const onCollectionInvalidated = vi.fn();

    renderHook(() => useTicketUpdates({ onNewTicket, onCollectionInvalidated }));
    const handleTicketUpdate = harness.handlers.get('ticket_update');
    act(() => handleTicketUpdate?.(payload));

    expect(onCollectionInvalidated).not.toHaveBeenCalled();
    expect(onNewTicket).not.toHaveBeenCalled();
  });

  it('preserves legacy full ticket updates for existing consumers', () => {
    const onNewTicket = vi.fn();

    renderHook(() => useTicketUpdates({ onNewTicket }));
    const handleTicketUpdate = harness.handlers.get('ticket_update');
    const update = { ticket: { id: 77, nro_ticket: 'CRM-77' } };
    act(() => handleTicketUpdate?.(update));

    expect(onNewTicket).toHaveBeenCalledWith(update);
  });
});
