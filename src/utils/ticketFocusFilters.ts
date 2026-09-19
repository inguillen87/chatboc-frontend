export const TICKET_FOCUS_FILTERS = {
  unread: 'unread',
  sla: 'risk',
  agent: 'unassigned',
} as const;
export type TicketFocusKey = keyof typeof TICKET_FOCUS_FILTERS;
export type TicketFocusState = Record<TicketFocusKey, string>;

/** Patch the existing inbox filters; preserve search, channel, area and role scope. */
export const toggleTicketFocus = <T extends TicketFocusState>(filters: T, key: TicketFocusKey): T => ({
  ...filters,
  [key]: filters[key] === TICKET_FOCUS_FILTERS[key] ? 'all' : TICKET_FOCUS_FILTERS[key],
});

/** Remove only these shortcuts, not a separately selected agent or SLA criterion. */
export const clearTicketFocus = <T extends TicketFocusState>(filters: T): T => {
  const next = { ...filters };
  for (const key of Object.keys(TICKET_FOCUS_FILTERS) as TicketFocusKey[]) {
    if (next[key] === TICKET_FOCUS_FILTERS[key]) next[key] = 'all';
  }
  return next;
};
