import { create } from 'zustand';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { isTenantSlugDeploymentHostnameMirror } from '@/utils/tenantHostname';

interface TenantState {
  slug: string | null;
  name: string | null;
  themeConfig: Record<string, any> | null;
  features: Record<string, boolean> | null;

  setTenant: (slug: string | null, data?: any) => void;
  clearTenant: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  slug: null,
  name: null,
  themeConfig: null,
  features: null,

  setTenant: (slug, data = {}) => {
    if (slug) {
      safeLocalStorage.setItem('tenantSlug', slug);
    } else {
      safeLocalStorage.removeItem('tenantSlug');
    }

    set({
      slug,
      name: data.name || null,
      themeConfig: data.themeConfig || null,
      features: data.features || null
    });
  },

  clearTenant: () => {
    safeLocalStorage.removeItem('tenantSlug');
    set({
      slug: null,
      name: null,
      themeConfig: null,
      features: null
    });
  }
}));

// Auto-load slug from storage if available
const storedInitialSlug = safeLocalStorage.getItem('tenantSlug');
const initialSlug =
  typeof window !== 'undefined' &&
  isTenantSlugDeploymentHostnameMirror(storedInitialSlug, window.location.hostname)
    ? null
    : storedInitialSlug;

if (storedInitialSlug && !initialSlug) {
  safeLocalStorage.removeItem('tenantSlug');
}

if (initialSlug) {
  useTenantStore.getState().setTenant(initialSlug);
}
