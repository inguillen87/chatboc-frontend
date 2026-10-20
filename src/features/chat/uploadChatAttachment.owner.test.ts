import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, captureWidgetRequestAuthority } from '@/utils/api';
import type { WidgetConversationHandle } from '@/utils/widgetConversationScope';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import {
  createChatAttachmentUploadAttempt, resolveBoundChatAttachmentUploadContext,
  uploadChatAttachment, type ChatAttachmentUploadContext,
} from './uploadChatAttachment';

vi.mock('@/utils/api', async importOriginal => ({
  ...await importOriginal<typeof import('@/utils/api')>(), apiFetch: vi.fn(),
}));
const deferred = <T,>() => { let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const prepared = {
  ok: true, contract_version: 'chat.attachment.direct.v1', operation: 'prepare_direct_upload',
  upload_id: 'fixture-upload', intent_token: 'same-fixture-intent',
  upload: { method: 'PUT', url: 'https://objects.example.test/fixture-owned', headers: { 'Content-Type': 'audio/webm' }, expires_in_seconds: 300 },
  constraints: { max_file_bytes: 1024, exact_size_required: true },
};
const form = () => { const value = new FormData(); value.append('file', new File(['fixture'], 'nota.webm', { type: 'audio/webm' })); return value; };

describe('attachment requests owned by the normal widget conversation', () => {
  const api = vi.mocked(apiFetch), objectPut = vi.fn();
  let active: boolean, owner: WidgetConversationHandle, context: ChatAttachmentUploadContext;
  beforeEach(() => {
    active = true; api.mockReset(); objectPut.mockReset(); safeLocalStorage.clear();
    vi.stubGlobal('fetch', objectPut);
    owner = {
      scopeKey: 'fixture-scope', sessionId: '22222222-2222-4222-8222-222222222222',
      tenantSlug: 'junin', anonId: 'fixture-scoped-anon', isCurrent: () => active,
      retire: () => false, adoptConfirmed: () => false,
      authority: captureWidgetRequestAuthority({ skipAuth: true, omitCredentials: true }),
    };
    context = { tenantSlug: owner.tenantSlug, chatSessionId: owner.sessionId, anonId: owner.anonId,
      conversationOwner: owner, isCurrent: () => true, skipAuth: true, omitCredentials: true };
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('preserves the matched owner and policy, and retires mismatched or pending scopes', async () => {
    expect(resolveBoundChatAttachmentUploadContext('junin', context)).toMatchObject(context);
    const mismatched = resolveBoundChatAttachmentUploadContext('another-tenant', context);
    expect(mismatched.chatSessionId).toBeNull(); expect(mismatched.conversationOwner).toBeUndefined();
    expect(mismatched.anonId).toBeUndefined(); expect(mismatched.skipAuth).toBeUndefined();
    expect(mismatched.isCurrent?.()).toBe(false);
    await expect(uploadChatAttachment('/legacy/upload', form, mismatched)).rejects.toMatchObject({ name: 'AbortError' });
    const pending = resolveBoundChatAttachmentUploadContext('junin', { tenantSlug: 'junin', isCurrent: () => false });
    await expect(uploadChatAttachment('/legacy/upload', form, pending)).rejects.toMatchObject({ name: 'AbortError' });
    expect(api).not.toHaveBeenCalled(); expect(objectPut).not.toHaveBeenCalled();
  });

  it('passes the captured session, anonymous identity and policy to canonical and alias stages', async () => {
    api.mockRejectedValueOnce(new ApiError('fixture compatibility', 404, {}))
      .mockResolvedValueOnce(prepared).mockResolvedValueOnce({ ok: true });
    objectPut.mockResolvedValueOnce(new Response('', { status: 200 }));
    await expect(uploadChatAttachment('/archivos/upload/chat_attachment', form, context)).resolves.toEqual({ ok: true });
    expect(api).toHaveBeenCalledTimes(3);
    expect(api.mock.calls[1][0]).toBe('/api/archivos/upload/chat_attachment');
    for (const [, options] of api.mock.calls) expect(options).toMatchObject({
      chatSessionId: owner.sessionId, anonId: owner.anonId, tenantSlug: 'junin', skipAuth: true, omitCredentials: true,
    });
    expect(objectPut).toHaveBeenCalledOnce();
  });

  it('keeps a captured context through a delayed prepare rather than reading mutated caller fields', async () => {
    const prepare = deferred<unknown>(); api.mockReturnValueOnce(prepare.promise).mockResolvedValueOnce({ ok: true });
    objectPut.mockResolvedValueOnce(new Response('', { status: 200 }));
    const pending = uploadChatAttachment('/archivos/upload/chat_attachment', form, context);
    context.chatSessionId = 'changed-caller-id'; context.anonId = 'changed-caller-anon'; context.skipAuth = false;
    prepare.resolve(prepared);
    await expect(pending).resolves.toEqual({ ok: true });
    for (const [, options] of api.mock.calls) expect(options).toMatchObject({
      chatSessionId: owner.sessionId, anonId: owner.anonId, skipAuth: true,
    });
  });

  it('rejects a delayed prepare for a retired owner without PUT, fallback or completion', async () => {
    const prepare = deferred<unknown>(); api.mockReturnValueOnce(prepare.promise);
    const pending = uploadChatAttachment('/archivos/upload/chat_attachment', form, context);
    active = false; prepare.resolve(prepared);
    expect(api.mock.calls[0][1]?.isCurrent?.()).toBe(false);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(api).toHaveBeenCalledOnce(); expect(objectPut).not.toHaveBeenCalled();
  });

  it.each(['tenantSlug', 'chatSessionId', 'anonId'] as const)('refuses mismatched owner %s before transport', async field => {
    context[field] = 'different';
    await expect(uploadChatAttachment('/legacy/upload', form, context)).rejects.toMatchObject({ name: 'AbortError' });
    expect(api).not.toHaveBeenCalled();
  });

  it('refuses a credential policy different from the captured conversation authority', async () => {
    context.omitCredentials = false;
    await expect(uploadChatAttachment('/legacy/upload', form, context)).rejects.toMatchObject({ name: 'AbortError' });
    expect(api).not.toHaveBeenCalled();
  });

  it('reconciles the same completion with the owner even when another legacy widget replaces the global ID', async () => {
    api.mockResolvedValueOnce(prepared).mockRejectedValueOnce(new TypeError('fixture lost completion'))
      .mockResolvedValueOnce({ ok: true });
    objectPut.mockResolvedValueOnce(new Response('', { status: 200 }));
    const attempt = createChatAttachmentUploadAttempt('/archivos/upload/chat_attachment', form, context);
    const failure = await attempt.run().catch(error => error);
    safeLocalStorage.setItem('chat_session_id', 'unrelated-legacy-session');
    expect(attempt.canRetry(failure)).toBe(true);
    await expect(attempt.run()).resolves.toEqual({ ok: true });
    expect(api).toHaveBeenCalledTimes(3); expect(objectPut).toHaveBeenCalledOnce();
    expect(api.mock.calls[2][1]?.body).toEqual(api.mock.calls[1][1]?.body);
    for (const [, options] of api.mock.calls) expect(options).toMatchObject({
      chatSessionId: owner.sessionId, anonId: owner.anonId, skipAuth: true, omitCredentials: true, singleAttempt: true,
    });
  });
});
