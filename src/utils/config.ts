import { sanitizeEntityToken } from "./entityToken";

export function getChatbocConfig() {
  const g = (window as any).CHATBOC_CONFIG || {};
  const sanitizedEntityToken = sanitizeEntityToken(
    typeof g.entityToken === 'string' ? g.entityToken : null
  ) || '';

  return {
    endpoint: g.endpoint || 'municipio',
    entityToken: sanitizedEntityToken,
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
  const raw = (window as any).CHATBOC_CONFIG?.entityToken;
  return sanitizeEntityToken(typeof raw === 'string' ? raw : null) || '';
}
