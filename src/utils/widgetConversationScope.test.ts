import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureWidgetConversationScope } from './widgetConversationScope';
import { safeLocalStorage } from './safeLocalStorage';
import { usePanelSessionStore } from '@/stores/panelSessionStore';
import { useWidgetSessionStore } from '@/stores/widgetSessionStore';

const prefix='chatboc_widget_conversation.v1:';
beforeEach(()=>{
  vi.stubGlobal('crypto',webcrypto);
  safeLocalStorage.clear();
  usePanelSessionStore.setState({authToken:null,user:null});
  useWidgetSessionStore.setState({chatAuthToken:null,entityToken:null});
  safeLocalStorage.setItem('chatboc_anon_id','synthetic-anonymous-'+webcrypto.randomUUID());
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('widget conversation persistence boundaries',()=>{
  it('never adopts the legacy global ID and scopes UUIDs by organization',async()=>{
    safeLocalStorage.setItem('chat_session_id',webcrypto.randomUUID());
    const first=await captureWidgetConversationScope({tenantSlug:'qa-first',skipAuth:true});
    const again=await captureWidgetConversationScope({tenantSlug:'qa-first',skipAuth:true});
    const other=await captureWidgetConversationScope({tenantSlug:'qa-other',skipAuth:true});
    expect(first.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(first.sessionId).toBe(again.sessionId);expect(other.sessionId).not.toBe(first.sessionId);
    expect(first.sessionId).not.toBe(safeLocalStorage.getItem('chat_session_id'));
    expect(first.isCurrent()).toBe(true);expect(other.isCurrent()).toBe(true);
  });
  it('keeps a stable per-key memory fallback when getItem works but setItem throws quota',async()=>{
    const original=Storage.prototype.setItem;
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(key,value){
      if(key.startsWith(prefix))throw new DOMException('Synthetic quota','QuotaExceededError');
      return original.call(this,key,value);
    });
    const first=await captureWidgetConversationScope({tenantSlug:'qa-quota',skipAuth:true});
    const second=await captureWidgetConversationScope({tenantSlug:'qa-quota',skipAuth:true});
    expect(first.sessionId).toBe(second.sessionId);expect(first.isCurrent()).toBe(true);
    expect(first.retire()).toBe(true);expect(first.isCurrent()).toBe(false);
    const next=await captureWidgetConversationScope({tenantSlug:'qa-quota',skipAuth:true});
    expect(next.sessionId).not.toBe(first.sessionId);expect(next.isCurrent()).toBe(true);
  });
  it('retires by expected owner when removeItem throws, preserving another tenant',async()=>{
    const first=await captureWidgetConversationScope({tenantSlug:'qa-remove',skipAuth:true});
    const other=await captureWidgetConversationScope({tenantSlug:'qa-other',skipAuth:true});
    const original=Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype,'removeItem').mockImplementation(function(key){
      if(key===first.scopeKey)throw new DOMException('Synthetic blocked removal','SecurityError');
      return original.call(this,key);
    });
    expect(first.retire()).toBe(true);expect(first.retire()).toBe(false);expect(first.isCurrent()).toBe(false);
    const replacement=await captureWidgetConversationScope({tenantSlug:'qa-remove',skipAuth:true});
    expect(replacement.sessionId).not.toBe(first.sessionId);expect(replacement.isCurrent()).toBe(true);
    expect(other.isCurrent()).toBe(true);
  });
  it('uses stable RAM-only opaque keys if WebCrypto is unavailable without persisting the credential',async()=>{
    const token='synthetic-widget-credential-that-must-stay-out-of-scope-records';
    useWidgetSessionStore.getState().setChatAuthToken(token);
    vi.stubGlobal('crypto',{randomUUID:webcrypto.randomUUID.bind(webcrypto),getRandomValues:webcrypto.getRandomValues.bind(webcrypto)});
    const first=await captureWidgetConversationScope({tenantSlug:'qa-no-crypto'});
    const second=await captureWidgetConversationScope({tenantSlug:'qa-no-crypto'});
    expect(first.sessionId).toBe(second.sessionId);expect(first.isCurrent()).toBe(true);
    for(let index=0;index<window.localStorage.length;index++){
      const key=window.localStorage.key(index)!;
      if(key.startsWith(prefix))expect(key+(window.localStorage.getItem(key)||'')).not.toContain(token);
    }
  });
});
