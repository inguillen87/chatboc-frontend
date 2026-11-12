import { ApiError } from '@/utils/api';
import { getOrCreateAnonId } from '@/utils/anonIdGenerator';
import getOrCreateChatSessionId from '@/utils/chatSessionId';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

export interface AudioRecoveryNotice {
  message: string;
  /** Reconcile the original attempt. Never create a fresh message identity. */
  retry?: () => Promise<void>;
}

export interface AudioRecoveryCallbacks {
  isCurrent: () => boolean;
  /** Retiring the local draft also retires this request's typing indicator. */
  onPending?: (retire: () => void) => void;
  onFailure: (notice: AudioRecoveryNotice) => void;
  onSuccess: () => void;
}

export interface RecoverableAudioAttempt<T> {
  run: () => Promise<T>;
  canRetry: (error: unknown) => boolean;
}

export const captureAudioRecoveryOwner = (isCurrent: () => boolean = () => true) => {
  const revision = captureChatbocSessionRevision();
  const anonId = getOrCreateAnonId();
  const sessionId = getOrCreateChatSessionId();
  return () => isCurrent() && isChatbocSessionRevisionCurrent(revision) &&
    (safeLocalStorage.getItem('chatboc_anon_id') || safeLocalStorage.getItem('anon_id')) === anonId &&
    safeLocalStorage.getItem('chat_session_id') === sessionId;
};

const reasonCode = (error: ApiError) => {
  const body = error.body;
  if (!body || typeof body !== 'object') return '';
  const record = body as Record<string, unknown>;
  return String(record.reason_code || record.code || '');
};

export const canReconcileMunicipalAudioError = (error: unknown) => {
  if ((error as Error)?.name === 'AbortError') return false;
  if (error instanceof ApiError) {
    const code = reasonCode(error);
    if (code.includes('reconciliation_required') || code.includes('replay_unavailable') ||
      code.includes('response_expired') || code.includes('scope') || code.includes('payload_conflict')) return false;
    return error.status === 425 || error.status >= 500;
  }
  // An unacknowledged transport is retried only behind the municipal ledger.
  return true;
};

export const createRecoverableAudioAttempt = <T>(
  send: () => Promise<T>,
  isCurrent: () => boolean,
  retryAllowed: (error: unknown) => boolean,
): RecoverableAudioAttempt<T> => {
  let pending = false;
  let completed = false;
  const assertCurrent = () => {
    if (!isCurrent()) throw new DOMException('Audio attempt retired', 'AbortError');
  };
  return {
    canRetry: (error) => !pending && !completed && isCurrent() && retryAllowed(error),
    run: async () => {
      assertCurrent();
      if (pending || completed) throw new DOMException('Audio attempt is unavailable', 'AbortError');
      pending = true;
      try {
        const response = await send();
        assertCurrent();
        completed = true;
        return response;
      } finally { pending = false; }
    },
  };
};

export const audioRecoveryMessage = (retryable: boolean) => retryable
  ? 'Conservamos tu grabación. Podés comprobar el mismo envío o descartarla; no se reenviará automáticamente.'
  : 'Conservamos tu grabación, pero no podemos confirmar su envío de forma segura. No la reenviaremos. Podés descartarla o escribir tu consulta.';
