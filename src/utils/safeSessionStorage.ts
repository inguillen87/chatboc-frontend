export const safeSessionStorage = {
  getItem(key: string): string | null {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem(key: string) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
  },
};
