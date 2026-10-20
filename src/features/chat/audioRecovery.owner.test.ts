import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAudioRecoveryOwner, createRecoverableAudioAttempt } from './audioRecovery';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

beforeEach(() => { safeLocalStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('scoped audio recovery ownership', () => {
  it('uses the explicit owner without reading or replacing a legacy session', () => {
    const read = vi.spyOn(safeLocalStorage, 'getItem').mockImplementation(() => { throw new Error('unexpected legacy read'); });
    const owner = { sessionId: 'scoped-session', anonId: 'scoped-anon', isCurrent: () => true };
    const current = captureAudioRecoveryOwner(() => true, owner);
    expect(current()).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });

  it('retires a recovery when either the recording or its conversation owner retires', () => {
    let recording = true, conversation = true;
    const current = captureAudioRecoveryOwner(() => recording, {
      sessionId: 'scoped-session', anonId: 'scoped-anon', isCurrent: () => conversation,
    });
    expect(current()).toBe(true);
    recording = false; expect(current()).toBe(false);
    recording = true; conversation = false; expect(current()).toBe(false);
  });

  it('preserves session authority retirement even if the owner callback remains true', async () => {
    const send = vi.fn().mockRejectedValue(new TypeError('uncertain-ack'));
    const current = captureAudioRecoveryOwner(undefined, {
      sessionId: 'scoped-session', anonId: 'scoped-anon', isCurrent: () => true,
    });
    const attempt = createRecoverableAudioAttempt(send, current, () => true);
    const failure = await attempt.run().catch(error => error);
    expect(attempt.canRetry(failure)).toBe(true);
    advanceChatbocSessionRevision();
    expect(attempt.canRetry(failure)).toBe(false);
    await expect(attempt.run()).rejects.toMatchObject({ name: 'AbortError' });
    expect(send).toHaveBeenCalledOnce();
  });

  it('keeps the no-owner legacy contract bound to its captured global session', () => {
    const current = captureAudioRecoveryOwner();
    expect(current()).toBe(true);
    safeLocalStorage.setItem('chat_session_id', 'replacement-legacy-session');
    expect(current()).toBe(false);
  });
});
