(function () {
  const NS = '__chatbocWidget__';
  if (window[NS]?.destroy) try { window[NS].destroy({reason:'reload'}); } catch {}
  if (document.getElementById('chatboc-widget-root')) return; // doble-protección

  const script = document.currentScript ||
    document.querySelector('script[data-chatboc-widget], script[src*="chatboc.ar/widget.js"]');
  const ds = script?.dataset || {};

  const cfg = {
    endpoint: ds.endpoint || 'municipio',
    entityToken: ds.token || '',                 // <-- SOLO token de ENTIDAD
    defaultOpen: ds.defaultOpen === 'true',
    width: ds.width || '460px',
    height: ds.height || '680px',
    closedWidth: ds.closedWidth || '72px',
    closedHeight: ds.closedHeight || '72px',
    bottom: ds.bottom || '20px',
    right: ds.right || '20px',
    host: new URL(script.src).origin,            // https://www.chatboc.ar
    iframePath: '/iframe.html',
    zIndex: 2147483000
  };

  // Raíz + Shadow DOM
  const root = document.createElement('div');
  root.id = 'chatboc-widget-root';
  Object.assign(root.style, {
    all:'initial', position:'fixed', bottom:cfg.bottom, right:cfg.right,
    width:cfg.closedWidth, height:cfg.closedHeight, zIndex:String(cfg.zIndex)
  });
  document.body.appendChild(root);
  const shadow = root.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial}
    .wrap{position:relative;width:100%;height:100%}
    .bubble{width:100%;height:100%;border-radius:50%;display:grid;place-items:center;
      background:#1778ff;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25);cursor:pointer;
      transition:transform .2s,opacity .2s;font:500 14px/1.2 system-ui}
    .iframe{position:absolute;right:0;bottom:0;width:${cfg.width};height:${cfg.height};
      border-radius:16px;overflow:hidden;opacity:0;pointer-events:none;background:#fff;
      box-shadow:0 18px 60px rgba(0,0,0,.35);transform:translateY(10px) scale(.98);
      transition:transform .2s,opacity .2s}
    .iframe.open{opacity:1;pointer-events:auto;transform:translateY(0) scale(1)}
    .hidden{display:none !important}
    @media (max-width:480px){
      :host,.wrap{width:100% !important;height:100% !important}
      :host{left:0;right:0;bottom:0}
      .iframe{width:100vw !important;height:100vh !important;border-radius:0}
    }`;
  shadow.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.innerHTML = `
    <button class="bubble" id="cb-bubble" aria-label="Abrir chat" title="Abrir chat">
      <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="10" r="1.6" fill="white"></circle>
        <circle cx="15" cy="10" r="1.6" fill="white"></circle>
        <path d="M7 14c1.3 1.6 3 2.4 5 2.4S15.7 15.6 17 14" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      </svg>
    </button>
    <div class="iframe" id="cb-frame"></div>`;
  shadow.appendChild(wrap);

  const iframe = document.createElement('iframe');
  iframe.title = 'Chatboc';
  iframe.allow = 'microphone; geolocation; clipboard-write';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.setAttribute('sandbox', 'allow-forms allow-popups allow-modals allow-scripts allow-same-origin allow-downloads');
  iframe.style.cssText = 'border:0;width:100%;height:100%';

  const qs = new URLSearchParams({
    endpoint: cfg.endpoint,
    entityToken: cfg.entityToken,
    defaultOpen: String(cfg.defaultOpen),
    width: cfg.width,
    height: cfg.height
  });
  iframe.src = `${cfg.host}${cfg.iframePath}?${qs.toString()}`;
  shadow.getElementById('cb-frame').appendChild(iframe);

  let open = false;
  function doOpen(){
    if(open) return; open = true;
    root.style.width = cfg.width; root.style.height = cfg.height;
    shadow.getElementById('cb-frame').classList.add('open');
    shadow.getElementById('cb-bubble').classList.add('hidden');
  }
  function doClose(){
    if(!open) return; open = false;
    root.style.width = cfg.closedWidth; root.style.height = cfg.closedHeight;
    shadow.getElementById('cb-frame').classList.remove('open');
    shadow.getElementById('cb-bubble').classList.remove('hidden');
  }

  shadow.getElementById('cb-bubble').addEventListener('click', doOpen);
  window.addEventListener('message', (ev)=>{
    const {type} = ev.data || {};
    if (type==='chatboc:open') doOpen();
    if (type==='chatboc:close') doClose();
  });

  if (cfg.defaultOpen) doOpen();

  window[NS] = {
    open: doOpen, close: doClose, toggle: ()=> open?doClose():doOpen(),
    setUserToken: (t)=> iframe.contentWindow?.postMessage({type:'chatboc:setUserToken', payload: t}, '*'),
    destroy: ()=>{ root.remove(); delete window[NS]; }
  };
})();
