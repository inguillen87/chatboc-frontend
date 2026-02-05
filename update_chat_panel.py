import sys

# We will read the file and do string replacements.

with open('src/components/chat/ChatPanel.tsx', 'r') as f:
    content = f.read()

# 1. Add forcePicker definition
# We look for "const rubrosEnabled ="
if "const rubrosEnabled =" in content:
    content = content.replace(
        "const rubrosEnabled = tipoChat === 'pyme';",
        """const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const forcePicker = searchParams?.get("picker") === "1" || searchParams?.get("show_rubros") === "true";
  const rubrosEnabled = tipoChat === 'pyme' || forcePicker;"""
    )
else:
    print("Could not find 'const rubrosEnabled ='")

# 2. Update showRubroSelector
# const showRubroSelector = rubrosEnabled && !localRubro && !tenantSlug && !propEntityToken;
if "const showRubroSelector = rubrosEnabled && !localRubro && !tenantSlug && !propEntityToken;" in content:
    content = content.replace(
        "const showRubroSelector = rubrosEnabled && !localRubro && !tenantSlug && !propEntityToken;",
        "const showRubroSelector = rubrosEnabled && !localRubro && ((!tenantSlug && !propEntityToken) || forcePicker);"
    )
else:
    print("Could not find 'const showRubroSelector ='")

# 3. Add auto-init effect for !rubrosEnabled
# We can add it after the existing effects.
# Look for "useEffect(() => {" that handles "!rubrosEnabled" which currently just removes local storage.
# It is around line 210.
# We will REPLACE that effect with one that also handles initialization.

old_effect = """  useEffect(() => {
    if (!rubrosEnabled) {
      safeLocalStorage.removeItem("rubroSeleccionado");
      safeLocalStorage.removeItem("rubroSeleccionado_label");
      lastInitializedRubro.current = null;
      const nextValue = extractRubroKey(selectedRubro);
      if (localRubro !== nextValue) {
        setLocalRubro(nextValue ?? null);
      }
      return;
    }"""

new_effect = """  useEffect(() => {
    if (!rubrosEnabled) {
      safeLocalStorage.removeItem("rubroSeleccionado");
      safeLocalStorage.removeItem("rubroSeleccionado_label");
      lastInitializedRubro.current = null;
      const nextValue = extractRubroKey(selectedRubro);
      if (localRubro !== nextValue) {
        setLocalRubro(nextValue ?? null);
      }
      // Auto-initialize for non-rubro modes (e.g. Municipio)
      if (messages.length === 0 && !isTyping) {
         initializeConversation({ force: false });
      }
      return;
    }"""

if old_effect in content:
    content = content.replace(old_effect, new_effect)
    # Also need to add dependencies to the array.
    # The array was: }, [rubrosEnabled, selectedRubro, localRubro]);
    # We should update it to include initializeConversation, messages.length, isTyping
    # But replacing dependencies via string match is risky if formatting differs.
    # Let's see. The closing bracket is likely nearby.
    # We can use regex or just be careful.
    pass
else:
    print("Could not find 'old_effect' block exactly.")
    # Fallback: Just insert a new effect at the end of component? No, better to patch the existing logic.
    # Let's try to match a smaller chunk.

with open('src/components/chat/ChatPanel.tsx', 'w') as f:
    f.write(content)

print("Updates applied to content string (in memory).")
