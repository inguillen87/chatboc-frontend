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
  iframe.src = `https://www.chatboc.ar/iframe?token=${encodeURIComponent(token)}`;
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
    iframe.style.display = "block";
  };
  iframe.style.display = "none"; // oculto hasta que cargue

  // Evita doble widget
  if (!document.getElementById("chatboc-widget")) document.body.appendChild(iframe);

  // BOTÓN DE CIERRE
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&#10005;";
  closeBtn.title = "Cerrar Chatboc";
  closeBtn.style.position = "fixed";
  closeBtn.style.bottom = `calc(${posBottom} + ${height} - 16px)`;
  closeBtn.style.right = `calc(${posRight} + 8px)`;
  closeBtn.style.zIndex = (parseInt(zIndex) + 1).toString();
  closeBtn.style.background = "#fff";
  closeBtn.style.color = "#2b7fff";
  closeBtn.style.border = "1px solid #cce1ff";
  closeBtn.style.borderRadius = "50%";
  closeBtn.style.width = "32px";
  closeBtn.style.height = "32px";
  closeBtn.style.boxShadow = "0 2px 8px #0002";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "18px";
  closeBtn.style.display = "flex";
  closeBtn.style.alignItems = "center";
  closeBtn.style.justifyContent = "center";
  closeBtn.onclick = function () {
    iframe.style.display = "none";
    closeBtn.style.display = "none";
  };
  if (!document.getElementById("chatboc-close-btn")) {
    closeBtn.id = "chatboc-close-btn";
    document.body.appendChild(closeBtn);
  }

  // DRAG & DROP
  let isDragging = false, startX, startY, startBottom, startRight;
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false });

  function dragStart(e) {
    isDragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startBottom = parseInt(iframe.style.bottom);
    startRight = parseInt(iframe.style.right);
    document.addEventListener("mousemove", dragMove);
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("touchmove", dragMove, { passive: false });
    document.addEventListener("touchend", dragEnd);
    e.preventDefault();
  }

  function dragMove(e) {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    let newRight = startRight + (startX - clientX);
    let newBottom = startBottom + (startY - clientY);
    // límites (no sacar de la pantalla)
    newRight = Math.max(0, Math.min(window.innerWidth - parseInt(width), newRight));
    newBottom = Math.max(0, Math.min(window.innerHeight - parseInt(height), newBottom));
    iframe.style.right = newRight + "px";
    iframe.style.bottom = newBottom + "px";
    closeBtn.style.right = (newRight + 8) + "px";
    closeBtn.style.bottom = `calc(${newBottom + parseInt(height) - 16}px)`;
  }

  function dragEnd() {
    isDragging = false;
    document.removeEventListener("mousemove", dragMove);
    document.removeEventListener("mouseup", dragEnd);
    document.removeEventListener("touchmove", dragMove);
    document.removeEventListener("touchend", dragEnd);
  }
})();
