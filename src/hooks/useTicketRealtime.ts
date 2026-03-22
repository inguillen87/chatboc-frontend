import { useEffect, useRef } from 'react';
import { useSocket } from '@/context/SocketContext';
import { safeOn } from '@/utils/safeOn';
import { trackFrontendEvent } from '@/utils/frontendTelemetry';
import { adaptRealtimeEnvelope, buildRealtimeDedupKey, toConversationStreamEnvelope, type EnterpriseRealtimeEnvelope } from '@/utils/realtime-envelope-adapter';

const ENTERPRISE_EVENTS = [
  'conversation.message.created',
  'conversation.message.read',
  'ticket.status.changed',
  'ticket.assignment.changed',
  'ticket.presence.changed',
  'ticket.unread.changed',
  'legacy.new_chat_message',
] as const;

interface UseTicketRealtimeOptions {
  ticketId?: string | number | null;
  onEnvelope?: (envelope: EnterpriseRealtimeEnvelope) => void;
  onRawEvent?: (eventName: string, payload: unknown) => void;
  maxDedupEntries?: number;
}

export function useTicketRealtime(options: UseTicketRealtimeOptions = {}) {
  const { ticketId, onEnvelope, onRawEvent, maxDedupEntries = 200 } = options;
  const { socket } = useSocket();
  const seenKeysRef = useRef<string[]>([]);
  const envelopeRef = useRef(onEnvelope);
  const rawEventRef = useRef(onRawEvent);

  useEffect(() => {
    envelopeRef.current = onEnvelope;
  }, [onEnvelope]);

  useEffect(() => {
    rawEventRef.current = onRawEvent;
  }, [onRawEvent]);

  useEffect(() => {
    if (!socket) return;

    const unsubscribers = ENTERPRISE_EVENTS.map((eventName) => {
      const handler = (payload: unknown) => {
        rawEventRef.current?.(eventName, payload);
        const enterpriseEnvelope = adaptRealtimeEnvelope(eventName, payload);
        if (!enterpriseEnvelope) return;

        if (ticketId != null && enterpriseEnvelope.ticket.id != null && String(enterpriseEnvelope.ticket.id) != String(ticketId)) {
          return;
        }

        const dedupKey = buildRealtimeDedupKey(enterpriseEnvelope);
        if (seenKeysRef.current.includes(dedupKey)) {
          trackFrontendEvent('realtime_duplicate_dropped', {
            event_name: eventName,
            ticket_id: enterpriseEnvelope.ticket.id ?? null,
            dedup_key: dedupKey,
          });
          return;
        }

        seenKeysRef.current = [...seenKeysRef.current.slice(-(maxDedupEntries - 1)), dedupKey];

        const normalized = toConversationStreamEnvelope(eventName, payload);
        envelopeRef.current?.({
          ...enterpriseEnvelope,
          payload: {
            ...(enterpriseEnvelope.payload || {}),
            ...(normalized ? { normalized_event: normalized } : {}),
          },
        });
      };

      safeOn(socket, eventName, handler);
      return () => socket.off(eventName, handler);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [socket, ticketId, maxDedupEntries]);
}

export default useTicketRealtime;
