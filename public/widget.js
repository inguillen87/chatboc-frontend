(function () {
  const script = document.currentScript;
  let token = script.getAttribute("data-token") || "demo-anon";

  // --- Configuración de Posición y Tamaño ---
  const initialBottom = script.getAttribute("data-bottom") || "20px";
  const initialRight = script.getAttribute("data-right") || "20px";
  const widgetWidth = script.getAttribute("data-width") || "360px";
  const widgetHeight = script.getAttribute("data-height") || "520px";
  const zIndexBase = parseInt(script.getAttribute("data-z") || "999990"); // Base z-index

  // Guardar la posición inicial para el botón de reapertura y el iframe
  let currentWidgetPos = {
    bottom: initialBottom,
    right: initialRight,
    left: "auto",
    top: "auto",
  };

  // --- Loader (sin cambios) ---
  const loader = document.createElement("div");
  loader.id = "chatboc-loader";
  loader.style.position = "fixed";
  loader.style.bottom = currentWidgetPos.bottom;
  loader.style.right = currentWidgetPos.right;
  loader.style.width = widgetWidth;
  loader.style.height = widgetHeight;
  loader.style.zIndex = zIndexBase;
  loader.style.display = "flex";
  loader.style.alignItems = "center";
  loader.style.justifyContent = "center";
  loader.innerHTML = `<div style="font-family: sans-serif; color: #333;">Cargando Chatboc...</div>`;
  if (!document.getElementById("chatboc-loader")) document.body.appendChild(loader);

  // --- Iframe (Ventana Principal del Chat) ---
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.chatboc.ar/iframe?token=${encodeURIComponent(token)}`; // Asegúrate que esta URL sea correcta
  iframe.style.position = "fixed";
  iframe.style.bottom = currentWidgetPos.bottom;
  iframe.style.right = currentWidgetPos.right;
  iframe.style.left = currentWidgetPos.left;
  iframe.style.top = currentWidgetPos.top;
  iframe.style.width = widgetWidth;
  iframe.style.height = widgetHeight;
  iframe.style.border = "none";
  iframe.style.zIndex = zIndexBase; // Iframe
  iframe.style.borderRadius = "16px";
  iframe.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  iframe.allow = "clipboard-write";
  iframe.setAttribute("title", "Chatboc Chatbot");
  iframe.id = "chatboc-widget";
  iframe.style.display = "none"; // Oculto hasta que cargue y se decida mostrar

  // --- Botón de Cierre 'X' (para el iframe abierto) ---
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&#10005;";
  closeBtn.title = "Cerrar Chatboc";
  closeBtn.style.position = "fixed";
  // Se posicionará dinámicamente al abrir/arrastrar
  closeBtn.style.zIndex = (zIndexBase + 1).toString(); // Encima del iframe
  closeBtn.style.background = "rgba(255,255,255,0.9)";
  closeBtn.style.color = "#555";
  closeBtn.style.border = "1px solid #ccc";
  closeBtn.style.borderRadius = "50%";
  closeBtn.style.width = "28px";
  closeBtn.style.height = "28px";
  closeBtn.style.boxShadow = "0 1px 4px rgba(0,0,0,0.15)";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "14px";
  closeBtn.style.lineHeight = "26px";
  closeBtn.style.textAlign = "center";
  closeBtn.style.display = "none"; // Oculto inicialmente

  // --- Botón de Reapertura (Globito/Logo) ---
  const reopenBtn = document.createElement("button");
  reopenBtn.id = "chatboc-reopen-btn";
  reopenBtn.title = "Abrir Chatboc";
  reopenBtn.style.position = "fixed";
  reopenBtn.style.bottom = currentWidgetPos.bottom;
  reopenBtn.style.right = currentWidgetPos.right;
  reopenBtn.style.left = currentWidgetPos.left;
  reopenBtn.style.top = currentWidgetPos.top;
  reopenBtn.style.width = "64px"; // Tamaño del globito
  reopenBtn.style.height = "64px";
  reopenBtn.style.borderRadius = "50%";
  reopenBtn.style.border = "1px solid #ccc"; // Estilo similar al ChatWidget standalone
  reopenBtn.style.background = "#fff"; // Puedes ajustar el color de fondo
  reopenBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
  reopenBtn.style.cursor = "pointer";
  reopenBtn.style.display = "none"; // Inicialmente oculto, se muestra cuando el iframe está cerrado por el usuario
  reopenBtn.style.padding = "0";
  reopenBtn.style.alignItems = "center";
  reopenBtn.style.justifyContent = "center";
  reopenBtn.style.zIndex = zIndexBase; // Mismo nivel que el iframe cuando está cerrado
  reopenBtn.innerHTML = `
    <img src="https://www.chatboc.ar/chatboc_logo_clean_transparent.png" alt="Chatboc" style="width: 32px; height: 32px; border-radius: 4px; pointer-events: none;">
    <span style="position: absolute; top: -2px; right: -2px; width: 12px; height: 12px; background-color: #28a745; border-radius: 50%; border: 2px solid white;"></span>
  `; // Logo similar al que tenías

  // Funciones para abrir y cerrar el widget (iframe)
  function openWidget() {
    iframe.style.display = "block";
    closeBtn.style.display = "flex"; // o 'block'
    reopenBtn.style.display = "none";
    positionCloseButton(); // Asegura que el botón X esté bien posicionado
  }

  function closeWidget() {
    iframe.style.display = "none";
    closeBtn.style.display = "none";
    reopenBtn.style.display = "flex"; // Mostrar el globito
    // Asegurar que el globito esté en la posición actual del widget
    reopenBtn.style.left = iframe.style.left;
    reopenBtn.style.top = iframe.style.top;
    reopenBtn.style.right = iframe.style.right;
    reopenBtn.style.bottom = iframe.style.bottom;

  }

  // Carga del Iframe
  iframe.onload = function () {
    if(document.getElementById("chatboc-loader")) loader.remove();
    openWidget(); // Mostrar el widget (iframe y botón X) cuando carga
  };

  // Añadir elementos al DOM
  if (!document.getElementById("chatboc-widget")) document.body.appendChild(iframe);
  if (!document.getElementById("chatboc-close-btn")) {
    closeBtn.id = "chatboc-close-btn";
    document.body.appendChild(closeBtn);
  }
  if (!document.getElementById("chatboc-reopen-btn")) document.body.appendChild(reopenBtn);

  // Event Listeners para los botones
  closeBtn.onclick = closeWidget;
  reopenBtn.onclick = openWidget;


  // --- Lógica de Arrastre (Drag & Drop) ---
  let isDragging = false, dragStartX, dragStartY, iframeStartLeft, iframeStartTop;

  // El área de arrastre es el iframe en sí, o podrías limitarlo al header del iframe si pudieras detectarlo.
  // Para simplificar, arrastramos el iframe completo.
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false });

  function positionCloseButton() {
    const iframeRect = iframe.getBoundingClientRect();
    // Posiciona el botón X en la esquina superior derecha del iframe
    closeBtn.style.top = (iframeRect.top + 8) + "px";
    closeBtn.style.left = (iframeRect.left + iframeRect.width - 28 - 8) + "px"; // 28px ancho botón, 8px margen
    closeBtn.style.right = "auto";
    closeBtn.style.bottom = "auto";
  }

  function dragStart(e) {
    // Prevenir arrastre si el click fue en un input, botón, etc. DENTRO del iframe.
    // Esta es una limitación, ya que no podemos inspeccionar fácilmente el target dentro del iframe.
    // Si el contenido del iframe captura el mousedown, este evento no se disparará en el iframe mismo.
    // Para un mejor UX, el header DENTRO del iframe podría comunicar al padre para iniciar el drag,
    // pero eso añade mucha complejidad (postMessage).
    // Por ahora, si se hace mousedown directo en el iframe (ej. en un área vacía del borde), permite arrastrar.

    isDragging = true;
    const rect = iframe.getBoundingClientRect();
    iframeStartLeft = rect.left;
    iframeStartTop = rect.top;
    dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
    dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
    
    iframe.style.userSelect = 'none';
    
    document.addEventListener("mousemove", dragMove);
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("touchmove", dragMove, { passive: false });
    document.addEventListener("touchend", dragEnd);
  }

  function dragMove(e) {
    if (!isDragging) return;
    if (e.cancelable && (e.type === 'touchmove')) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let newLeft = iframeStartLeft + (clientX - dragStartX);
    let newTop = iframeStartTop + (clientY - dragStartY);

    const iframeWidthNum = parseInt(widgetWidth);
    const iframeHeightNum = parseInt(widgetHeight);
    newLeft = Math.max(0, Math.min(window.innerWidth - iframeWidthNum, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - iframeHeightNum, newTop));

    iframe.style.left = newLeft + "px";
    iframe.style.top = newTop + "px";
    iframe.style.right = "auto";
    iframe.style.bottom = "auto";

    // Mover el botón de cierre y el de reapertura con el iframe
    positionCloseButton();
    reopenBtn.style.left = newLeft + "px";
    reopenBtn.style.top = newTop + "px";
    reopenBtn.style.right = "auto";
    reopenBtn.style.bottom = "auto";
    // Si quieres que el reopenBtn mantenga su posición original bottom/right:
    // En lugar de left/top, tendrías que calcular el nuevo bottom/right para el reopenBtn
    // reopenBtn.style.bottom = (window.innerHeight - newTop - parseInt(reopenBtn.style.height)) + "px";
    // reopenBtn.style.right = (window.innerWidth - newLeft - parseInt(reopenBtn.style.width)) + "px";
    // Pero es más simple que el reopenBtn siga la esquina superior izquierda del iframe como referencia.
    // O, más sencillo aún, que el reopenBtn siempre use la `initialBottom`, `initialRight`
    // y no se mueva con el drag, sino que aparezca donde el widget fue cargado inicialmente.
    // Para este ejemplo, el reopenBtn se mueve con el iframe.
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    iframe.style.userSelect = '';
    document.removeEventListener("mousemove", dragMove);
    document.removeEventListener("mouseup", dragEnd);
    document.removeEventListener("touchmove", dragMove);
    document.removeEventListener("touchend", dragEnd);
  }
})();