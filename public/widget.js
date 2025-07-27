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

  document.write(`
    <div id="chatboc-widget-container" style="position: fixed; bottom: 0; right: 0; width: 400px; height: 600px; z-index: 2147483647; border: none; background: transparent; overflow: hidden;">
      <iframe id="${iframeId}" title="Chatboc Widget" src="${iframeSrc}" style="width: 100%; height: 100%; border: none; background: transparent;" allow="clipboard-write; geolocation"></iframe>
    </div>
  `);
})();
