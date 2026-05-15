import { beforeEach, describe, expect, it } from 'vitest';
import { resolveOmnichannelContactKey, resolveOmnichannelConversationId, resolveTenantSlug } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

describe('resolveOmnichannelContactKey', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
  });

  it('prioritizes explicit X-Contact-Key header when present', () => {
    const resolved = resolveOmnichannelContactKey('from-option', { 'X-Contact-Key': 'from-header' }, 'anon-123');
    expect(resolved).toBe('from-header');
  });

  it('uses explicit contact key option when headers do not provide one', () => {
    const resolved = resolveOmnichannelContactKey('from-option', {}, 'anon-123');
    expect(resolved).toBe('from-option');
  });

  it('falls back to stored user contact key', () => {
    safeLocalStorage.setItem('user', JSON.stringify({ contact_key: 'user-contact-key' }));
    const resolved = resolveOmnichannelContactKey(null, {}, 'anon-123');
    expect(resolved).toBe('user-contact-key');
  });

  it('falls back to anon id when no contact context exists', () => {
    const resolved = resolveOmnichannelContactKey(null, {}, 'anon-123');
    expect(resolved).toBe('anon-123');
  });

  it('uses persisted identity contact key before user/storage fallbacks', () => {
    safeLocalStorage.setItem('user', JSON.stringify({ contact_key: 'user-contact-key' }));
    const resolved = resolveOmnichannelContactKey(null, {}, 'anon-123', { contactKey: 'persisted-contact-key' });
    expect(resolved).toBe('persisted-contact-key');
  });
});

describe('resolveTenantSlug persistence control', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
  });

  it('does not overwrite the stored tenant when persistence is disabled for demo requests', () => {
    safeLocalStorage.setItem('tenantSlug', 'colegio-pago');

    const resolved = resolveTenantSlug('municipio', '/api/public/lead-capture', { persist: false });

    expect(resolved).toBe('municipio');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('colegio-pago');
  });
});

describe('resolveOmnichannelConversationId', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
  });

  it('prioritizes explicit X-Conversation-Id header when present', () => {
    const resolved = resolveOmnichannelConversationId('from-option', { 'X-Conversation-Id': 'from-header' });
    expect(resolved).toBe('from-header');
  });

  it('uses explicit conversation option when header is absent', () => {
    const resolved = resolveOmnichannelConversationId('from-option', {});
    expect(resolved).toBe('from-option');
  });

  it('falls back to public chat context conversation id', () => {
    safeLocalStorage.setItem('chatboc_public_chat_context', JSON.stringify({ conversation_id: 'wa-conv-1' }));
    const resolved = resolveOmnichannelConversationId(null, {});
    expect(resolved).toBe('wa-conv-1');
  });

  it('uses persisted identity conversation id before storage fallbacks', () => {
    safeLocalStorage.setItem('chatboc_public_chat_context', JSON.stringify({ conversation_id: 'wa-conv-1' }));
    const resolved = resolveOmnichannelConversationId(null, {}, { conversationId: 'persisted-conv-id' });
    expect(resolved).toBe('persisted-conv-id');
  });
});
