(function () {
  const script = document.currentScript;
  let token = script.getAttribute("data-token") || "demo-anon";

  const posBottom = script.getAttribute("data-bottom") || "20px";
  const posRight = script.getAttribute("data-right") || "20px";
  const width = script.getAttribute("data-width") || "360px";
  const height = script.getAttribute("data-height") || "520px";
  const zIndex = script.getAttribute("data-z") || "999999"; // zIndex para el iframe

  const loader = document.createElement("div");
  loader.id = "chatboc-loader";
  loader.style.position = "fixed";
  loader.style.bottom = posBottom;
  loader.style.right = posRight;
  loader.style.zIndex = zIndex; // Loader usa el mismo zIndex que el iframe
  loader.style.width = width;
  loader.style.height = height;
  loader.style.display = "flex";
  loader.style.alignItems = "center";
  loader.style.justifyContent = "center";
  // Simple text loader for now, or use your spinner if you ensure styles are self-contained
  loader.innerHTML = `<div style="font-family: sans-serif; color: #333;">Cargando Chatboc...</div>
  <style>
    @keyframes spin { 100% { transform: rotate(360deg); } }
  </style>`;
  if (!document.getElementById("chatboc-loader")) document.body.appendChild(loader);

  const iframe = document.createElement("iframe");
  iframe.src = `https://www.chatboc.ar/iframe?token=${encodeURIComponent(token)}`; // Asegúrate que esta URL sea correcta
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

  iframe.onload = function () {
    if(document.getElementById("chatboc-loader")) loader.remove();
    iframe.style.display = "block";
    if(closeBtn) closeBtn.style.display = "flex"; // Mostrar botón de cierre cuando el iframe carga
  };
  iframe.style.display = "none"; 

  if (!document.getElementById("chatboc-widget")) document.body.appendChild(iframe);

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&#10005;";
  closeBtn.title = "Cerrar Chatboc";
  closeBtn.style.position = "fixed";
  // Posición del botón de cierre relativa a la esquina superior DERECHA del iframe
  // Si el iframe tiene height y posBottom, su 'top' es effectively window.innerHeight - posBottom - height
  // Para ponerlo arriba a la derecha del iframe:
  // bottom: `calc(${posBottom} + ${height} - 32px - 8px)` (32px alto botón, 8px margen)
  // right: `calc(${posRight} + 8px)`
  // Lo ajustamos para que esté claramente asociado al iframe
  let closeBtnTop = `calc(100vh - ${posBottom} - ${height} + 8px)`; // Asumiendo que posBottom es desde el fondo
  let closeBtnRight = `calc(${posRight} + 8px)`;

  // Si el iframe se define con 'top' en lugar de 'bottom'
  // const posTop = script.getAttribute("data-top");
  // if (posTop) { closeBtnTop = `calc(${posTop} + 8px)`; }


  closeBtn.style.top = closeBtnTop; // Ajustado para la esquina superior derecha
  closeBtn.style.right = closeBtnRight;
  closeBtn.style.zIndex = (parseInt(zIndex) + 1).toString(); // Encima del iframe
  closeBtn.style.background = "rgba(255,255,255,0.9)";
  closeBtn.style.color = "#555";
  closeBtn.style.border = "1px solid #ccc";
  closeBtn.style.borderRadius = "50%";
  closeBtn.style.width = "28px";
  closeBtn.style.height = "28px";
  closeBtn.style.boxShadow = "0 1px 4px rgba(0,0,0,0.15)";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "14px";
  closeBtn.style.lineHeight = "26px"; // Centrar la X
  closeBtn.style.textAlign = "center"; // Centrar la X
  closeBtn.style.display = "none"; // Oculto hasta que el iframe cargue
  closeBtn.style.alignItems = "center"; // Para flex, si se usa
  closeBtn.style.justifyContent = "center"; // Para flex, si se usa

  closeBtn.onclick = function () {
    iframe.style.display = "none";
    closeBtn.style.display = "none";
    // Podrías añadir un botón para reabrirlo o que se quede cerrado hasta un refresh
  };
  if (!document.getElementById("chatboc-close-btn")) {
    closeBtn.id = "chatboc-close-btn";
    document.body.appendChild(closeBtn);
  }

  let isDragging = false, dragStartX, dragStartY, iframeStartLeft, iframeStartTop;
  
  // Solo el iframe es arrastrable, no el botón de cierre por separado.
  // El botón se moverá con el iframe.
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false });

  function dragStart(e) {
    // No arrastrar si se hizo clic en un input, botón, etc. dentro del iframe
    if (e.target !== iframe) return;

    isDragging = true;
    const rect = iframe.getBoundingClientRect();
    iframeStartLeft = rect.left;
    iframeStartTop = rect.top;
    dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
    dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
    
    iframe.style.userSelect = 'none'; // Evitar selección de texto en iframe al arrastrar
    
    document.addEventListener("mousemove", dragMove);
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("touchmove", dragMove, { passive: false });
    document.addEventListener("touchend", dragEnd);
    // No necesitamos e.preventDefault() aquí en el iframe directamente,
    // pero sí en los document listeners para el dragMove si es touch.
  }

  function dragMove(e) {
    if (!isDragging) return;
    if (e.cancelable && (e.type === 'touchmove')) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let newLeft = iframeStartLeft + (clientX - dragStartX);
    let newTop = iframeStartTop + (clientY - dragStartY);

    // Limitar a la pantalla
    const iframeWidth = parseInt(width);
    const iframeHeight = parseInt(height);
    newLeft = Math.max(0, Math.min(window.innerWidth - iframeWidth, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - iframeHeight, newTop));

    iframe.style.left = newLeft + "px";
    iframe.style.top = newTop + "px";
    iframe.style.right = "auto"; // Cambiar a posicionamiento left/top
    iframe.style.bottom = "auto";

    // Actualizar posición del botón de cierre
    // closeBtn.style.top = (newTop + 8) + "px";
    // closeBtn.style.right = `calc(100vw - ${newLeft + iframeWidth - 8 - 28}px)`; // Complejo
    // Es más fácil si el botón se recalcula con el nuevo top/left del iframe:
    closeBtn.style.left = (newLeft + iframeWidth - 28 - 8) + "px"; // 28px ancho botón, 8px margen
    closeBtn.style.top = (newTop + 8) + "px";
    closeBtn.style.right = "auto";
    closeBtn.style.bottom = "auto";
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    iframe.style.userSelect = ''; // Restaurar
    document.removeEventListener("mousemove", dragMove);
    document.removeEventListener("mouseup", dragEnd);
    document.removeEventListener("touchmove", dragMove);
    document.removeEventListener("touchend", dragEnd);
  }
})();