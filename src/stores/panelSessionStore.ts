import { create } from 'zustand';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

export interface PanelUser {
  id: string;
  email: string;
  rol: string;
  name?: string;
  tenant_slug?: string;
  [key: string]: any;
}

interface PanelSessionState {
  authToken: string | null;
  user: PanelUser | null;
  setAuthToken: (token: string | null) => void;
  setUser: (user: PanelUser | null) => void;
  clearSession: () => void;
  loadFromStorage: () => void;
}

export const usePanelSessionStore = create<PanelSessionState>((set) => ({
  authToken: null,
  user: null,

  setAuthToken: (token) => {
    if (token) {
      safeLocalStorage.setItem('authToken', token);
    } else {
      safeLocalStorage.removeItem('authToken');
    }
    set({ authToken: token });
  },

  setUser: (user) => {
    if (user) {
      safeLocalStorage.setItem('user', JSON.stringify(user));
    } else {
      safeLocalStorage.removeItem('user');
    }
    set({ user });
  },

  clearSession: () => {
    safeLocalStorage.removeItem('authToken');
    safeLocalStorage.removeItem('user');
    set({ authToken: null, user: null });
  },

  loadFromStorage: () => {
    const token = safeLocalStorage.getItem('authToken');
    const userStr = safeLocalStorage.getItem('user');
    let user = null;
    try {
      if (userStr) {
        user = JSON.parse(userStr);
      }
    } catch (e) {
      console.warn('Error parsing user from storage', e);
    }
    set({ authToken: token, user });
  }
}));

// Auto-load on creation
usePanelSessionStore.getState().loadFromStorage();
