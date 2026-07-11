type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const firstString = (source: UnknownRecord | null, keys: string[]) => {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const firstTicketId = (source: UnknownRecord | null): string | number | null => {
  if (!source) return null;
  for (const key of ['ticket_id', 'ticketId']) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const ticket = asRecord(source.ticket);
  const nested = ticket?.id;
  if (typeof nested === 'number' && Number.isFinite(nested)) return nested;
  return typeof nested === 'string' && nested.trim() ? nested.trim() : null;
};

export const resolveLiveChatRealtimeAccess = (...sources: unknown[]) => {
  const expanded: UnknownRecord[] = [];
  sources.forEach((value) => {
    const source = asRecord(value);
    if (!source) return;
    expanded.push(source);
    const metadata = asRecord(source.metadata);
    const liveChat = asRecord(source.live_chat) ?? asRecord(source.liveChat);
    const transport = asRecord(source.transport);
    if (metadata) expanded.push(metadata);
    if (liveChat) {
      expanded.push(liveChat);
      const liveTransport = asRecord(liveChat.transport);
      if (liveTransport) expanded.push(liveTransport);
    }
    if (transport) expanded.push(transport);
  });

  let room: string | null = null;
  let accessToken: string | null = null;
  let ticketId: string | number | null = null;
  let status: string | null = null;
  for (const source of expanded) {
    room ||= firstString(source, ['socket_room', 'socketRoom']);
    accessToken ||= firstString(source, [
      'live_chat_access_token',
      'liveChatAccessToken',
      'access_token',
      'accessToken',
    ]);
    ticketId ??= firstTicketId(source);
    status ||= firstString(source, ['status', 'estado', 'ticket_status', 'ticketStatus']);
    if (room && accessToken && ticketId !== null && status) break;
  }

  return { room, accessToken, ticketId, status };
};

export const resolveLiveChatRealtimeEnvelopeAccess = (payload: unknown) => {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const result = asRecord(root?.result);
  return resolveLiveChatRealtimeAccess(root, data, result);
};

export const buildLiveChatJoinPayload = (room: string, accessToken?: string | null) => ({
  room,
  ...(accessToken ? { access_token: accessToken } : {}),
});
