(function () {
  "use strict";

  const script = document.currentScript;
  const token = script.getAttribute("data-token") || "demo-anon";
  const chatbocDomain = script.getAttribute("data-domain") || new URL(script.src).origin;
  const iframeId = `chatboc-iframe-${Math.random().toString(36).substring(2, 9)}`;

  const params = new URLSearchParams();
  for (const attr of script.attributes) {
    if (attr.name.startsWith('data-')) {
      params.set(attr.name.replace('data-', ''), attr.value);
    }
  }
  params.set('widgetId', iframeId);
  params.set('token', token);
  params.set('hostDomain', window.location.origin);

  const iframeSrc = `${chatbocDomain}/iframe.html?${params.toString()}`;

  const container = document.createElement('div');
  container.id = 'chatboc-widget-container';
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: 'open' });

  const iframe = document.createElement('iframe');
  iframe.id = iframeId;
  iframe.title = 'Chatboc Widget';
  iframe.src = iframeSrc;
  iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: transparent;';
  iframe.allow = 'clipboard-write; geolocation';

  const style = document.createElement('style');
  style.textContent = `
    :host {
      position: fixed;
      bottom: 0;
      right: 0;
      width: 400px;
      height: 600px;
      z-index: 2147483647;
      border: none;
      background: transparent;
      overflow: hidden;
    }
  `;

  shadow.appendChild(style);
  shadow.appendChild(iframe);
})();
