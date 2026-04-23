import re

with open('src/hooks/useUser.tsx', 'r') as f:
    content = f.read()

# Replace local storage manipulations inside `refreshUser` with Zustand calls
# Specifically `safeLocalStorage.setItem('user', JSON.stringify(updated)); setUser(updated);`
# -> `setUser(updated);` (since setUser in Zustand handles localStorage)

# And `safeLocalStorage.removeItem('user'); setUser(null);`
# -> `setUser(null);`

content = content.replace("safeLocalStorage.setItem('user', JSON.stringify(updated));\n      setUser(updated);", "setUser(updated);")
content = content.replace("safeLocalStorage.removeItem('user');\n        if (tokenKey) {\n          safeLocalStorage.removeItem(tokenKey);\n        }\n        setUser(null);", "setUser(null);\n        usePanelSessionStore.getState().setAuthToken(null);\n        useWidgetSessionStore.getState().setChatAuthToken(null);")


with open('src/hooks/useUser.tsx', 'w') as f:
    f.write(content)
