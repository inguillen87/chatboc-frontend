import { create } from 'zustand';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { trackFrontendEvent } from '@/utils/frontendTelemetry';
import { getOrCreateAnonId } from '@/utils/anonIdGenerator';
import getOrCreateChatSessionId from '@/utils/chatSessionId';

type WidgetStatus = 'idle' | 'bootstrapping' | 'ready' | 'error';

interface WidgetSessionState {
  status: WidgetStatus;
  errorMessage: string | null;
  anonId: string | null;
  sessionId: string | null;
  chatAuthToken: string | null;
  entityToken: string | null;
  contactKey: string | null;
  conversationId: string | null;

  bootstrapWidget: (config?: any) => void;
  setChatAuthToken: (token: string | null) => void;
  setOmnichannelIdentity: (contactKey: string | null, conversationId: string | null) => void;
  clearSession: () => void;
}

export const useWidgetSessionStore = create<WidgetSessionState>((set) => ({
  status: 'idle',
  errorMessage: null,
  anonId: null,
  sessionId: null,
  chatAuthToken: null,
  entityToken: null,
  contactKey: null,
  conversationId: null,

  bootstrapWidget: (config = {}) => {
    const startTime = performance.now();
    set({ status: 'bootstrapping', errorMessage: null });
    try {
      const anonId = getOrCreateAnonId();
      const sessionId = getOrCreateChatSessionId();

      const chatAuthToken = safeLocalStorage.getItem('chatAuthToken');
      const entityToken = config.entityToken || safeLocalStorage.getItem('entityToken') || null;

      const storedIdentityRaw = safeLocalStorage.getItem('chatboc_omnichannel_identity:global');
      let contactKey = null;
      let conversationId = null;
      if (storedIdentityRaw) {
        try {
           const parsed = JSON.parse(storedIdentityRaw);
           contactKey = parsed.contactKey || null;
           conversationId = parsed.conversationId || null;
        } catch(e) {}
      }

      set({
        anonId,
        sessionId,
        chatAuthToken,
        entityToken,
        contactKey,
        conversationId,
        status: 'ready'
      });

      trackFrontendEvent('widget_bootstrap_success', {
         duration_ms: performance.now() - startTime,
         has_entity_token: !!entityToken,
         has_auth: !!chatAuthToken
      });
    } catch (error) {
      console.error("[WidgetSessionStore] Bootstrap failed", error);
      trackFrontendEvent('widget_bootstrap_error', {
         duration_ms: performance.now() - startTime,
         error: error instanceof Error ? error.message : String(error)
      });
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Error inicializando el widget'
      });
    }
  },

  setChatAuthToken: (token) => {
    if (token) {
      safeLocalStorage.setItem('chatAuthToken', token);
    } else {
      safeLocalStorage.removeItem('chatAuthToken');
    }
    set({ chatAuthToken: token });
  },

  setOmnichannelIdentity: (contactKey, conversationId) => {
    set({ contactKey, conversationId });
  },

  clearSession: () => {
    safeLocalStorage.removeItem('chatAuthToken');
    safeLocalStorage.removeItem('chatboc_omnichannel_identity:global');
    // NOTE: We don't remove anonId or entityToken typically on logout, but depending on rules we might.
    set({ chatAuthToken: null, contactKey: null, conversationId: null, status: 'idle' });
  }
}));
