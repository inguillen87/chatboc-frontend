import re

with open('src/utils/api.ts', 'r') as f:
    content = f.read()

# Add zustand stores imports
import_stores = """import { usePanelSessionStore, useWidgetSessionStore, useTenantStore } from '@/stores';
"""
if "import { usePanelSessionStore" not in content:
    content = content.replace('import { safeLocalStorage } from "@/utils/safeLocalStorage";', 'import { safeLocalStorage } from "@/utils/safeLocalStorage";\n' + import_stores)

# Fix 401 clearing logic
patch_401_panel = """
        console.warn("Received 401 Unauthorized for a panel request. Redirecting to login.");
        usePanelSessionStore.getState().clearSession();
        useWidgetSessionStore.getState().clearSession();
"""
content = re.sub(
    r'console\.warn\("Received 401 Unauthorized for a panel request\. Redirecting to login\."\);\n\s*safeLocalStorage\.removeItem\("authToken"\);\n\s*safeLocalStorage\.removeItem\("user"\);\n\s*safeLocalStorage\.removeItem\("chatAuthToken"\);',
    patch_401_panel.strip(),
    content
)

patch_401_widget = """
      if (tokenSource === "authToken") {
        if (!preserveAuthOn401) {
          usePanelSessionStore.getState().setAuthToken(null);
        }
      } else if (tokenSource === "chatAuthToken") {
        if (!preserveAuthOn401) {
          useWidgetSessionStore.getState().setChatAuthToken(null);
        }
      }
"""
content = re.sub(
    r'if \(tokenSource === "authToken"\) \{\n\s*if \(\!preserveAuthOn401\) \{\n\s*safeLocalStorage\.removeItem\("authToken"\);\n\s*\}\n\s*\} else if \(tokenSource === "chatAuthToken"\) \{\n\s*if \(\!preserveAuthOn401\) \{\n\s*safeLocalStorage\.removeItem\("chatAuthToken"\);\n\s*\}\n\s*\}',
    patch_401_widget.strip(),
    content
)

# Replace getting tokens with Zustand getState() inside apiFetch (lines ~600)
patch_get_tokens = """
  const panelToken = usePanelSessionStore.getState().authToken || safeLocalStorage.getItem("authToken");
  const chatToken = useWidgetSessionStore.getState().chatAuthToken || safeLocalStorage.getItem("chatAuthToken");
  let storedRole: string | null = null;
"""
content = re.sub(
    r'const panelToken = safeLocalStorage\.getItem\("authToken"\);\n\s*const chatToken = safeLocalStorage\.getItem\("chatAuthToken"\);\n\s*let storedRole: string \| null = null;',
    patch_get_tokens.strip(),
    content
)

with open('src/utils/api.ts', 'w') as f:
    f.write(content)
