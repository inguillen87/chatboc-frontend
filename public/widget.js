(function () {
  const GLOBAL = window;
  const WIDGET_NS = '__chatbocWidget__';
  if (GLOBAL[WIDGET_NS]?.destroy) {
    // Si ya había uno, lo destruyo para evitar estados sucios
    try { GLOBAL[WIDGET_NS].destroy({ reason: 'reload' }); } catch {}
  }

  // Lee opciones del <script> que te embeben
  // Permite también pasar options por window.ChatbocConfig antes de cargar el script
  const currentScript =
    document.currentScript ||
    document.querySelector('script[data-chatboc-widget], script[src*="chatboc.ar/widget.js"]');

  const dataset = currentScript ? currentScript.dataset : {};
  const cfg = Object.assign(
    {
      // defaults
      endpoint: 'municipio',          // 'municipio' | 'pyme'
      entityToken: dataset.token || '',     // token público de la entidad
      userToken: null,                      // opcional
      defaultOpen: dataset.defaultOpen === 'true',
      width: dataset.width || '460px',
      height: dataset.height || '680px',
      closedWidth: dataset.closedWidth || '72px',
      closedHeight: dataset.closedHeight || '72px',
      bottom: dataset.bottom || '20px',
      right: dataset.right || '20px',
      host: (new URL(currentScript.src)).origin, // https://www.chatboc.ar
      iframePath: '/iframe.html',               // ruta real (existe)
      zIndex: 2147483000
    },
    GLOBAL.ChatbocConfig || {}
  );

  // Contenedor raíz + Shadow DOM para aislar estilos
  const rootId = 'chatboc-widget-root';
  let root = document.getElementById(rootId);
  if (root) root.remove();
  root = document.createElement('div');
  root.id = rootId;
  root.style.all = 'initial';
  root.style.position = 'fixed';
  root.style.inset = 'auto';
  root.style.bottom = cfg.bottom;
  root.style.right = cfg.right;
  root.style.width = cfg.closedWidth;
  root.style.height = cfg.closedHeight;
  root.style.zIndex = String(cfg.zIndex);
  root.setAttribute('aria-live', 'polite');
  document.body.appendChild(root);

  const shadow = root.attachShadow({ mode: 'open' });

  // Estilos del widget dentro del Shadow
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .wrap { position: relative; width: 100%; height: 100%; }
    .bubble {
      box-sizing: border-box;
      width: 100%; height: 100%;
      border-radius: 50%;
      display: grid; place-items: center;
      background: #1778ff; color: white;
      box-shadow: 0 10px 30px rgba(0,0,0,.25);
      cursor: pointer;
      transition: transform .2s ease, opacity .2s ease;
      font: 500 14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;
      user-select: none;
    }
    .bubble:hover { transform: translateY(-1px); }
    .iframeWrap {
      position: absolute; right: 0; bottom: 0;
      width: ${cfg.width}; height: ${cfg.height};
      border-radius: 16px; overflow: hidden; opacity: 0; pointer-events: none;
      box-shadow: 0 18px 60px rgba(0,0,0,.35);
      transform: translateY(10px) scale(.98);
      transition: transform .2s ease, opacity .2s ease;
      background: #fff;
    }
    .iframeWrap.open { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }
    .closeBtn {
      position: absolute; top: 8px; right: 8px;
      background: rgba(0,0,0,.6); color: #fff; border: 0;
      width: 28px; height: 28px; border-radius: 14px; cursor: pointer;
    }
    .hidden { display: none !important; }

    /* Responsive (mobile) */
    @media (max-width: 480px) {
      :host, .wrap { width: 100% !important; height: 100% !important; }
      :host { position: fixed; bottom: 0; right: 0; left: 0; }
      .iframeWrap { width: 100vw !important; height: 100vh !important; border-radius: 0; }
    }
  `;
  shadow.appendChild(style);

  // Burbuja
  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.innerHTML = `
    <div class="bubble" id="cb-bubble" aria-label="Abrir chat Chatboc" role="button" tabindex="0">
      <!-- reemplazá por tu SVG de carita -->
      <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill="white" opacity=".1"></circle>
        <circle cx="9" cy="10" r="1.6" fill="white"></circle>
        <circle cx="15" cy="10" r="1.6" fill="white"></circle>
        <path d="M7 14c1.3 1.6 3 2.4 5 2.4S15.7 15.6 17 14" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="iframeWrap" id="cb-frameWrap">
      <button class="closeBtn" id="cb-close" aria-label="Cerrar chat">✕</button>
    </div>
  `;
  shadow.appendChild(wrap);

  // Iframe
  const iframe = document.createElement('iframe');
  iframe.title = 'Chatboc';
  iframe.allow = 'microphone; geolocation; clipboard-write';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.setAttribute('allowfullscreen', 'true');
  // Sandbox: quitar permisos peligrosos pero permitir lo necesario
  iframe.setAttribute('sandbox', [
    'allow-forms', 'allow-popups', 'allow-modals',
    'allow-scripts', 'allow-same-origin', 'allow-downloads'
  ].join(' '));

  const qs = new URLSearchParams({
    endpoint: cfg.endpoint,
    entityToken: cfg.entityToken,
    defaultOpen: String(cfg.defaultOpen),
    width: cfg.width,
    height: cfg.height
  });
  if (cfg.userToken) qs.set('userToken', cfg.userToken);

  iframe.src = `${cfg.host}${cfg.iframePath}?${qs.toString()}`;
  iframe.style.border = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';

  shadow.getElementById('cb-frameWrap').appendChild(iframe);

  // Estado y helpers
  let isOpen = false;
  function open() {
    if (isOpen) return;
    isOpen = true;
    root.style.width = cfg.width;
    root.style.height = cfg.height;
    shadow.getElementById('cb-frameWrap').classList.add('open');
    shadow.getElementById('cb-bubble').classList.add('hidden');
    post({ type: 'chatboc:event', payload: 'open' });
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.style.width = cfg.closedWidth;
    root.style.height = cfg.closedHeight;
    shadow.getElementById('cb-frameWrap').classList.remove('open');
    shadow.getElementById('cb-bubble').classList.remove('hidden');
    post({ type: 'chatboc:event', payload: 'close' });
  }
  function toggle() { isOpen ? close() : open(); }

  // Eventos UI
  shadow.getElementById('cb-bubble').addEventListener('click', open);
  shadow.getElementById('cb-bubble').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') open();
  });
  shadow.getElementById('cb-close').addEventListener('click', close);

  // Canal postMessage (parent <-> iframe)
  function post(msg) {
    try { iframe.contentWindow.postMessage(msg, '*'); } catch {}
  }
  window.addEventListener('message', (ev) => {
    const { type, payload } = ev.data || {};
    if (type === 'chatboc:open') open();
    if (type === 'chatboc:close') close();
    if (type === 'chatboc:unread') {
      // podés pintar badge en la burbuja si querés
    }
  });

  // Auto-open si defaultOpen
  if (cfg.defaultOpen) open();

  // Exponer API global idempotente
  GLOBAL[WIDGET_NS] = {
    open, close, toggle,
    setUserToken: (t) => { cfg.userToken = t; post({ type: 'chatboc:setUserToken', payload: t }); },
    destroy: ({ reason } = {}) => {
      try { window.removeEventListener('message', post); } catch {}
      if (root && root.parentNode) root.parentNode.removeChild(root);
      delete GLOBAL[WIDGET_NS];
      // Opcional: log
      // console.info('Chatboc widget destroyed', reason || '');
    }
  };
})();
