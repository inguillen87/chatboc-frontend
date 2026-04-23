import re

with open('src/context/TenantContext.tsx', 'r') as f:
    content = f.read()

# Add zustand stores imports
import_stores = """import { useTenantStore } from '@/stores';
"""
if "import { useTenantStore" not in content:
    content = content.replace("import React,", import_stores + "import React,")

# Connect the useTenantStore in the TenantContext to gradually replace `currentSlug`
# so they are in sync.
# Find `setTenant(info);` and inject `useTenantStore.getState().setTenant(info?.slug, info);`
# And `setCurrentSlug(slug);` inject `useTenantStore.getState().setTenant(slug);`
# etc...

patch_fetch_success = """
      if (activeTenantRequest.current === requestId) {
        setTenant(info);
        if (info?.slug) {
           setCurrentSlug(info.slug);
           currentSlugRef.current = info.slug;
           useTenantStore.getState().setTenant(info.slug, info);
        }
      }
"""

content = content.replace("""      if (activeTenantRequest.current === requestId) {
        setTenant(info);
        if (info?.slug) {
           setCurrentSlug(info.slug);
           currentSlugRef.current = info.slug;
        }
      }""", patch_fetch_success)

patch_fetch_error = """
        if (recoverable) {
          setCurrentSlug(null);
          currentSlugRef.current = null;
          useTenantStore.getState().clearTenant();
        }
"""
content = content.replace("""        if (recoverable) {
          setCurrentSlug(null);
          currentSlugRef.current = null;
        }""", patch_fetch_error)


with open('src/context/TenantContext.tsx', 'w') as f:
    f.write(content)
