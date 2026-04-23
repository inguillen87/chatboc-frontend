import re

with open('src/hooks/useUser.tsx', 'r') as f:
    content = f.read()

# Add zustand stores imports
import_stores = """import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
"""
if "import { usePanelSessionStore" not in content:
    content = content.replace("import React,", import_stores + "import React,")

# useUser right now keeps local state.
# We should refactor it to rely on panelSessionStore / widgetSessionStore mostly,
# but it seems it uses Context.

# To not break too many things, let's keep the hook api signature `useUser(): { user, setUser, refreshUser, loading }`
# but bridge it to Zustand.

bridge_logic = """
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const panelStore = usePanelSessionStore();
  const widgetStore = useWidgetSessionStore();
  const [loading, setLoading] = useState(false);

  const user = panelStore.user;

  // Let's use a simpler bridge
"""

# Actually, the user context is consumed heavily. Since the epic FE-B says "replace scattered state accesses",
# bridging useUser to usePanelSessionStore.getState().setUser is a good start.

# We'll just proxy the Zustand store to the Context for now to maintain full backwards compatibility while upgrading state handling.

patch = """
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setUser } = usePanelSessionStore();
  const [loading, setLoading] = useState(false);
"""

content = re.sub(
    r"export const UserProvider: React.FC<\{ children: React.ReactNode \}> = \(\{ children \}\) => \{.*?const \[loading, setLoading\] = useState\(false\);",
    patch,
    content,
    flags=re.DOTALL
)

with open('src/hooks/useUser.tsx', 'w') as f:
    f.write(content)
