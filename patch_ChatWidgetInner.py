import re

with open('src/components/chat/ChatWidgetInner.tsx', 'r') as f:
    content = f.read()

# Add zustand import
import_stores = """import { useWidgetSessionStore } from '@/stores';
"""
if "import { useWidgetSessionStore" not in content:
    content = content.replace("import React,", import_stores + "import React,")

# To integrate `widgetSessionStore`, we'll initialize it in `ChatWidgetInner` effect
bootstrap_logic = """
  const widgetStore = useWidgetSessionStore();

  useEffect(() => {
    if (widgetStore.status === 'idle') {
      widgetStore.bootstrapWidget({ entityToken: ownerToken || undefined });
    }
  }, [widgetStore, ownerToken]);
"""
# Insert after `const lastOwnerTokenRef = useRef...`
content = content.replace("const lastOwnerTokenRef = useRef<string | null | undefined>(ownerToken);", "const lastOwnerTokenRef = useRef<string | null | undefined>(ownerToken);\n" + bootstrap_logic)

with open('src/components/chat/ChatWidgetInner.tsx', 'w') as f:
    f.write(content)
