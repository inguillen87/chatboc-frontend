import { safeLocalStorage } from '@/utils/safeLocalStorage';

export function getChatbocConfig() {
  const g = (window as any).CHATBOC_CONFIG || {};
  const storedToken = safeLocalStorage.getItem('entityToken') || '';
  const effectiveEntityToken =
    typeof g.entityToken === 'string' && g.entityToken.trim()
      ? g.entityToken
      : storedToken;
  return {
    endpoint: g.endpoint || 'municipio',
    entityToken: effectiveEntityToken,
    userToken: g.userToken || null,
    defaultOpen: !!g.defaultOpen,
    width: g.width || '460px',
    height: g.height || '680px',
    closedWidth: g.closedWidth || '72px',
    closedHeight: g.closedHeight || '72px',
    bottom: g.bottom || '20px',
    right: g.right || '20px',
    primaryColor: g.primaryColor || '#007aff',
    accentColor: g.accentColor || '',
    logoUrl: g.logoUrl || '',
    headerLogoUrl: g.headerLogoUrl || g.logoUrl || '',
    logoAnimation: g.logoAnimation || '',
    welcomeTitle: g.welcomeTitle || '',
    welcomeSubtitle: g.welcomeSubtitle || ''
  };
}

export function getIframeToken(): string {
  const globalToken = (window as any).CHATBOC_CONFIG?.entityToken;
  if (typeof globalToken === 'string' && globalToken.trim()) {
    return globalToken;
  }

  try {
    return safeLocalStorage.getItem('entityToken') || '';
  } catch {
    return '';
  }
}
