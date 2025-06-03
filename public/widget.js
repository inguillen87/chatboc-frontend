(function () {
  const script = document.currentScript;
  let token = script.getAttribute("data-token");

  if (!token || token === "demo-anon") {
    // Si no hay token, mostramos sólo el demo anónimo
    token = "demo-anon";
  }

  const iframe = document.createElement("iframe");
  iframe.src = `https://www.chatboc.ar/iframe?token=${encodeURIComponent(token)}`;
  iframe.style.position = "fixed";
  iframe.style.bottom = "20px";
  iframe.style.right = "20px";
  iframe.style.width = "360px";
  iframe.style.height = "520px";
  iframe.style.border = "none";
  iframe.style.zIndex = "999999";
  iframe.style.borderRadius = "16px";
  iframe.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
  iframe.allow = "clipboard-write";
  iframe.setAttribute("title", "Chatboc Chatbot");

  // Evitar doble widget
  if (!document.getElementById("chatboc-widget")) {
    iframe.id = "chatboc-widget";
    document.body.appendChild(iframe);
  }
})();
