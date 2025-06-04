(function () {
  const script = document.currentScript;
  let token = script.getAttribute("data-token") || "demo-anon";

  // Posiciones custom por atributos
  const posBottom = script.getAttribute("data-bottom") || "20px";
  const posRight = script.getAttribute("data-right") || "20px";
  const width = script.getAttribute("data-width") || "360px";
  const height = script.getAttribute("data-height") || "520px";
  const zIndex = script.getAttribute("data-z") || "999999";

  // Loader
  const loader = document.createElement("div");
  loader.id = "chatboc-loader";
  loader.style.position = "fixed";
  loader.style.bottom = posBottom;
  loader.style.right = posRight;
  loader.style.zIndex = zIndex;
  loader.style.width = width;
  loader.style.height = height;
  loader.style.display = "flex";
  loader.style.alignItems = "center";
  loader.style.justifyContent = "center";
  loader.innerHTML = `<div style="border:4px solid #2b7fff;border-top:4px solid #fff;border-radius:50%;width:36px;height:36px;animation:spin 1s linear infinite;"></div>
  <style>
    @keyframes spin { 100% { transform: rotate(360deg); } }
  </style>`;
  if (!document.getElementById("chatboc-loader")) document.body.appendChild(loader);

  // IFRAME
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.chatboc.ar/iframe?token=${encodeURIComponent(token)}`; // Asegúrate que esta URL sea la de tu app
  iframe.style.position = "fixed";
  iframe.style.bottom = posBottom;
  iframe.style.right = posRight;
  iframe.style.width = width;
  iframe.style.height = height;
  iframe.style.border = "none";
  iframe.style.zIndex = zIndex;
  iframe.style.borderRadius = "16px";
  iframe.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  iframe.allow = "clipboard-write";
  iframe.setAttribute("title", "Chatboc Chatbot");
  iframe.id = "chatboc-widget";

  // Mostrar el iframe solo cuando termine de cargar
  iframe.onload = function () {
    loader.remove();
    iframe.style.display = "block"; // Muestra el iframe
    closeBtn.style.display = "flex"; // Muestra el botón de cierre
  };
  iframe.style.display = "none"; // oculto hasta que cargue

  // Evita doble widget
  if (!document.getElementById("chatboc-widget")) document.body.appendChild(iframe);

  // BOTÓN DE CIERRE EXTERNO
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&#10005;"; // Símbolo 'X'
  closeBtn.title = "Cerrar Chatboc";
  closeBtn.style.position = "fixed";
  // Posición del botón de cierre relativa a la esquina superior DERECHA del iframe
  closeBtn.style.bottom = `calc(${posBottom} + ${height} - 16px - 12px)`; // Ajustado para estar dentro, arriba
  closeBtn.style.right = `calc(${posRight} + 12px)`; // Ajustado para estar dentro, a la derecha
  closeBtn.style.zIndex = (parseInt(zIndex) + 1).toString(); // Encima del iframe
  closeBtn.style.background = "#fff";
  closeBtn.style.color = "#2b7fff";
  closeBtn.style.border = "1px solid #cce1ff";
  closeBtn.style.borderRadius = "50%";
  closeBtn.style.width = "32px";
  closeBtn.style.height = "32px";
  closeBtn.style.boxShadow = "0 2px 8px #0002";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "18px";
  closeBtn.style.display = "none"; // Oculto hasta que el iframe cargue
  closeBtn.style.alignItems = "center";
  closeBtn.style.justifyContent = "center";
  
  closeBtn.onclick = function () {
    iframe.style.display = "none"; // Oculta el iframe
    closeBtn.style.display = "none"; // Oculta el botón de cierre
    // Aquí faltaría la lógica para mostrar un "globito" para reabrir.
  };
  if (!document.getElementById("chatboc-close-btn")) {
    closeBtn.id = "chatboc-close-btn";
    document.body.appendChild(closeBtn);
  }

  // DRAG & DROP (Lógica de arrastre que tenías)
  let isDragging = false, startX, startY, startBottom, startRight;
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false });

  function dragStart(e) {
    // Prevenir arrastre si el click fue en un input, botón, etc. DENTRO del iframe.
    // Esta es una heurística. Si el contenido del iframe no propaga el evento, puede no funcionar.
    const targetTagName = e.target ? (e.target as HTMLElement).tagName.toLowerCase() : '';
    if (targetTagName === 'input' || targetTagName === 'textarea' || targetTagName === 'button' || targetTagName === 'a') {
        return;
    }
    if (e.target !== iframe) { // Si el click no es directamente en el iframe (ej. scrollbar), no arrastrar
        // A menos que el contenido del iframe esté específicamente diseñado para propagar eventos de drag al padre.
        // Esta condición puede ser muy restrictiva.
        // return;
    }


    isDragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    // Leer la posición actual basada en estilos (puede ser bottom/right o top/left)
    const rect = iframe.getBoundingClientRect();
    iframeStartLeft = rect.left;
    iframeStartTop = rect.top;
    
    // Desactivar transición para arrastre fluido
    iframe.style.transition = 'none'; 
    document.body.style.userSelect = 'none'; // Evitar selección de texto en la página
    document.body.style.cursor = 'move';


    document.addEventListener("mousemove", dragMove);
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("touchmove", dragMove, { passive: false });
    document.addEventListener("touchend", dragEnd);
    if (e.type === 'touchstart' && e.cancelable) e.preventDefault();
  }

  function dragMove(e) {
    if (!isDragging) return;
    if (e.type === 'touchmove' && e.cancelable) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Calcular nueva posición left/top
    let newLeft = iframeStartLeft + (clientX - dragStartX);
    let newTop = iframeStartTop + (clientY - dragStartY);

    // Mantener dentro de la ventana
    const iframeWidthNum = parseInt(width);
    const iframeHeightNum = parseInt(height);
    newLeft = Math.max(0, Math.min(window.innerWidth - iframeWidthNum, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - iframeHeightNum, newTop));

    iframe.style.left = newLeft + "px";
    iframe.style.top = newTop + "px";
    iframe.style.right = "auto"; // Cambiar a posicionamiento left/top
    iframe.style.bottom = "auto";

    // Mover el botón de cierre con el iframe
    closeBtn.style.left = (newLeft + iframeWidthNum - parseInt(closeBtn.style.width) - 12) + "px"; // Ajustar posición del botón X
    closeBtn.style.top = (newTop + 12) + "px";
    closeBtn.style.right = "auto";
    closeBtn.style.bottom = "auto";
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    // Reactivar transición si tenías alguna
    // iframe.style.transition = '...'; // La tuya no tenía transición aquí
    document.body.style.userSelect = '';
    document.body.style.cursor = 'default';
    document.removeEventListener("mousemove", dragMove);
    document.removeEventListener("mouseup", dragEnd);
    document.removeEventListener("touchmove", dragMove);
    document.removeEventListener("touchend", dragEnd);
  }
})();