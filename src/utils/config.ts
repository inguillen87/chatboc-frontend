export function getChatbocConfig() {
  const g = (window as any).CHATBOC_CONFIG || {};
  return {
    endpoint: g.endpoint || 'municipio',
    entityToken: g.entityToken || '',
    userToken: g.userToken || null,
    defaultOpen: !!g.defaultOpen,
    width: g.width || '460px',
    height: g.height || '680px'
  };
}

export function getIframeToken(): string {
  return (window as any).CHATBOC_CONFIG?.entityToken || '';
}
