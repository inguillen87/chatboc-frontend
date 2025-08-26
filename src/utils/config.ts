export function getChatbocConfig() {
  const g = (window as any).CHATBOC_CONFIG || {};
  return {
    endpoint: g.endpoint || 'municipio',
    entityToken: g.entityToken || '',
    userToken: g.userToken || null
  };
}
