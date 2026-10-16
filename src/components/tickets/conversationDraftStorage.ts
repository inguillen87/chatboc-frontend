import { safeLocalStorage } from '@/utils/safeLocalStorage';

const CONVERSATION_DRAFT_VERSION = 1 as const;
const CONVERSATION_DRAFT_PREFIX = `chatboc:ticket-composer-draft:v${CONVERSATION_DRAFT_VERSION}`;
const MAX_DRAFT_LENGTH = 20_000;
const CONVERSATION_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

type ConversationDraftEnvelope = {
  version: typeof CONVERSATION_DRAFT_VERSION;
  text: string;
  updatedAt: string;
};

export type ConversationDraftScope = {
  tenant: string;
  sourceModel: string;
  ticketId: string | number;
  operator: string;
};

const normalizeScopePart = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return encodeURIComponent(normalized || fallback);
};

export const buildConversationDraftStorageKey = (scope: ConversationDraftScope): string => [
  CONVERSATION_DRAFT_PREFIX,
  normalizeScopePart(scope.tenant, 'tenant-unknown'),
  normalizeScopePart(scope.sourceModel, 'source-unknown'),
  normalizeScopePart(scope.ticketId, 'ticket-unknown'),
  normalizeScopePart(scope.operator, 'operator-unknown'),
].join(':');

export const readConversationDraft = (storageKey: string | null): string => {
  if (!storageKey) return '';
  const stored = safeLocalStorage.getItem(storageKey);
  if (!stored) return '';

  const discardStoredDraft = () => {
    safeLocalStorage.removeItem(storageKey);
    return '';
  };

  try {
    const envelope = JSON.parse(stored) as Partial<ConversationDraftEnvelope>;
    const updatedAt = typeof envelope.updatedAt === 'string'
      ? Date.parse(envelope.updatedAt)
      : Number.NaN;
    if (
      envelope.version !== CONVERSATION_DRAFT_VERSION ||
      typeof envelope.text !== 'string' ||
      envelope.text.length > MAX_DRAFT_LENGTH ||
      !Number.isFinite(updatedAt) ||
      updatedAt > Date.now() ||
      Date.now() - updatedAt > CONVERSATION_DRAFT_TTL_MS
    ) return discardStoredDraft();
    return envelope.text;
  } catch {
    return discardStoredDraft();
  }
};

export const persistConversationDraft = (storageKey: string | null, text: string): void => {
  if (!storageKey) return;
  if (!text) {
    safeLocalStorage.removeItem(storageKey);
    return;
  }

  const envelope: ConversationDraftEnvelope = {
    version: CONVERSATION_DRAFT_VERSION,
    text: text.slice(0, MAX_DRAFT_LENGTH),
    updatedAt: new Date().toISOString(),
  };
  safeLocalStorage.setItem(storageKey, JSON.stringify(envelope));
};

export const removeConversationDraft = (storageKey: string | null, expectedText?: string): void => {
  if (!storageKey) return;
  if (expectedText !== undefined && readConversationDraft(storageKey) !== expectedText) return;
  safeLocalStorage.removeItem(storageKey);
};
