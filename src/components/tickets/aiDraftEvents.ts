export const TICKET_AI_DRAFT_EVENT_NAME = 'chatboc:ticket-ai-draft';

export interface TicketAiDraftEventDetail {
  ticketId: string;
  draft: string;
  source?: string;
}

export const dispatchTicketAiDraft = (detail: TicketAiDraftEventDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<TicketAiDraftEventDetail>(TICKET_AI_DRAFT_EVENT_NAME, { detail }));
};

export const isTicketAiDraftEvent = (event: Event): event is CustomEvent<TicketAiDraftEventDetail> => {
  const detail = (event as CustomEvent<TicketAiDraftEventDetail>).detail;
  return Boolean(
    detail &&
      typeof detail === 'object' &&
      typeof detail.ticketId === 'string' &&
      typeof detail.draft === 'string' &&
      detail.draft.trim(),
  );
};
