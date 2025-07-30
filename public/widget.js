(function () {
  "use strict";

  const script = document.currentScript;
  const chatbocDomain = script.getAttribute("data-domain") || new URL(script.src).origin;
  const iframeId = `chatboc-iframe-${Math.random().toString(36).substring(2, 9)}`;

  const params = new URLSearchParams();
  for (const attr of script.attributes) {
    if (attr.name.startsWith('data-')) {
      const key = attr.name.replace('data-', '');
      const value = attr.value;
      params.set(key, value);
      console.log(`Widget.js: Param set: ${key} = ${value}`);
    }
  }

  if (!params.has('token')) {
    params.set('token', 'demo-anon');
    console.log("Widget.js: No data-token found, using 'demo-anon'");
  }

  params.set('widgetId', iframeId);
  params.set('hostDomain', window.location.origin);

  const iframeSrc = `${chatbocDomain}/iframe?${params.toString()}`;
  console.log("Widget.js: Iframe source:", iframeSrc);

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
      bottom: 20px;
      right: 20px;
      width: 100px;
      height: 100px;
      z-index: 2147483647;
      border: none;
      background: transparent;
      overflow: visible;
      transition: width 0.3s ease, height 0.3s ease;
    }
  `;

  shadow.appendChild(style);
  shadow.appendChild(iframe);

  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow || !event.data.widgetId || event.data.widgetId !== iframeId) {
      return;
    }

    if (event.data.type === 'chatboc-state-change') {
      const { dimensions, isOpen } = event.data;
      const host = shadow.host;
      if (isOpen) {
        host.style.width = dimensions.width;
        host.style.height = dimensions.height;
      } else {
        host.style.width = dimensions.width;
        host.style.height = dimensions.height;
      }
    }
  });

})();
