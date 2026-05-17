import { describe, expect, it, beforeEach } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import {
  clearCachedWidgetToken,
  normalizeWidgetTenantScopeSlug,
  persistWidgetTokenScope,
  readWidgetTokenScope,
  resolveWidgetTokenForTenant,
} from './widgetTokenScope';

describe('widgetTokenScope', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
  });

  it('normalizes tenant domain slugs to their canonical token scope', () => {
    expect(normalizeWidgetTenantScopeSlug('bodega.chatboc.ar')).toBe('bodega');
    expect(normalizeWidgetTenantScopeSlug(' BODEGA ')).toBe('bodega');
  });

  it('keeps a scoped widget token for the same canonical tenant', () => {
    persistWidgetTokenScope('token-123', 'bodega.chatboc.ar');

    expect(readWidgetTokenScope()).toEqual({ token: 'token-123', tenantSlug: 'bodega' });
    expect(resolveWidgetTokenForTenant('token-123', 'bodega')).toBe('token-123');
  });

  it('clears a cached widget token when the active tenant changes', () => {
    safeLocalStorage.setItem('widgetToken', 'token-123');
    persistWidgetTokenScope('token-123', 'municipio');

    expect(resolveWidgetTokenForTenant('token-123', 'bodega.chatboc.ar')).toBeNull();
    expect(safeLocalStorage.getItem('widgetToken')).toBeNull();
    expect(readWidgetTokenScope()).toBeNull();
  });

  it('removes legacy widget token aliases together', () => {
    safeLocalStorage.setItem('entityToken', 'entity-token');
    safeLocalStorage.setItem('owner_token', 'owner-token');
    persistWidgetTokenScope('scoped-token', 'municipio');

    clearCachedWidgetToken();

    expect(safeLocalStorage.getItem('entityToken')).toBeNull();
    expect(safeLocalStorage.getItem('owner_token')).toBeNull();
    expect(readWidgetTokenScope()).toBeNull();
  });
});
