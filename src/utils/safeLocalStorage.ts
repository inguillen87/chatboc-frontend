export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  },
};
