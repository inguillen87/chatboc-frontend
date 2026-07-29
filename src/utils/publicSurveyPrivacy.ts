const LEGACY_PUBLIC_SURVEY_DRAFT_PREFIX = 'chatboc:survey:draft:';
const LEGACY_OFFLINE_QUEUE_KEY = 'chatboc_offline_draft_queue';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export interface PublicSurveyPrivacyPurgeResult {
  removedDrafts: number;
  removedQueuedResponses: number;
}

/**
 * Removes historical public-response drafts that may contain answers or PII.
 * Unrelated local data and non-response offline actions are preserved verbatim.
 */
export const purgeLegacyPublicSurveyPersistence = (): PublicSurveyPrivacyPurgeResult => {
  const result: PublicSurveyPrivacyPurgeResult = {
    removedDrafts: 0,
    removedQueuedResponses: 0,
  };

  if (typeof window === 'undefined') return result;

  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return result;
  }

  try {
    const draftKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(LEGACY_PUBLIC_SURVEY_DRAFT_PREFIX)) {
        draftKeys.push(key);
      }
    }
    draftKeys.forEach((key) => storage.removeItem(key));
    result.removedDrafts = draftKeys.length;
  } catch {
    // Storage can be denied independently for enumeration and mutation.
  }

  try {
    const rawQueue = storage.getItem(LEGACY_OFFLINE_QUEUE_KEY);
    if (!rawQueue) return result;

    const parsedQueue: unknown = JSON.parse(rawQueue);
    if (!Array.isArray(parsedQueue)) return result;

    const retained = parsedQueue.filter((entry) => {
      const isLegacySurveyResponse = isRecord(entry) && entry.type === 'survey_response';
      if (isLegacySurveyResponse) result.removedQueuedResponses += 1;
      return !isLegacySurveyResponse;
    });

    if (result.removedQueuedResponses === 0) return result;
    if (retained.length === 0) {
      storage.removeItem(LEGACY_OFFLINE_QUEUE_KEY);
    } else {
      storage.setItem(LEGACY_OFFLINE_QUEUE_KEY, JSON.stringify(retained));
    }
  } catch {
    // Leave malformed or inaccessible queue data untouched.
  }

  return result;
};
