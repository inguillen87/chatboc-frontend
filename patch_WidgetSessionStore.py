import re

with open('src/stores/widgetSessionStore.ts', 'r') as f:
    content = f.read()

# Add telemetry import
import_tel = """import { trackFrontendEvent } from '@/utils/frontendTelemetry';
"""
if "import { trackFrontendEvent" not in content:
    content = content.replace("import { getOrCreateAnonId }", import_tel + "import { getOrCreateAnonId }")

# Instrument the bootstrap call
instrument_bootstrap = """
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
"""

content = re.sub(
    r'set\(\{ status: \'bootstrapping\', errorMessage: null \}\);\n\s*try \{.*?set\(\{\s*status: \'error\', \s*errorMessage: error instanceof Error \? error\.message : \'Error inicializando el widget\'\s*\}\);\n\s*\}',
    instrument_bootstrap.strip(),
    content,
    flags=re.DOTALL
)

with open('src/stores/widgetSessionStore.ts', 'w') as f:
    f.write(content)
