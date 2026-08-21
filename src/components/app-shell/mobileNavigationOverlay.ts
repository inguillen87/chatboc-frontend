export const MOBILE_NAVIGATION_BODY_CLASS = "chatboc-mobile-menu-open";

let mobileNavigationOpen = false;
const listeners = new Set<() => void>();

export const setMobileNavigationOpen = (open: boolean) => {
  if (typeof document !== "undefined") {
    document.body.classList.toggle(MOBILE_NAVIGATION_BODY_CLASS, open);
  }

  if (mobileNavigationOpen === open) return;

  mobileNavigationOpen = open;
  listeners.forEach((listener) => listener());
};

export const subscribeToMobileNavigation = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getMobileNavigationSnapshot = () => mobileNavigationOpen;
export const getMobileNavigationServerSnapshot = () => false;
