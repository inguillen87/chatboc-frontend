(function() {
  'use strict';

  const container = document.getElementById('chatboc-widget-container');
  if (!container) {
    console.error('Chatboc widget container not found.');
    return;
  }

  const iframe = document.createElement('iframe');
  const token = window.chatbocToken || '';
  const endpoint = window.chatbocEndpoint || 'pyme';
  const primaryColor = window.chatbocPrimaryColor || '#007bff';
  const logoUrl = window.chatbocLogoUrl || '';
  const position = window.chatbocPosition || 'right';

  let src = `https://www.chatboc.ar/embed?token=${token}&tipo_chat=${endpoint}`;
  src += `&primaryColor=${encodeURIComponent(primaryColor)}`;
  src += `&logoUrl=${encodeURIComponent(logoUrl)}`;
  src += `&position=${position}`;

  iframe.src = src;
  iframe.style.border = 'none';
  iframe.style.width = '400px';
  iframe.style.height = '600px';
  iframe.allow = 'clipboard-write; geolocation';
  iframe.loading = 'lazy';
  iframe.title = 'Chatboc Widget';

  container.appendChild(iframe);
})();
