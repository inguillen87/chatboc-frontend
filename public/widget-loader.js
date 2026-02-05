(function () {
  function getAttr(script, name) {
    return script.getAttribute(name) || script.getAttribute("data-" + name) || "";
  }

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var tenant = getAttr(script, "tenant");
  var entityToken = getAttr(script, "entity-token");
  var host = getAttr(script, "host") || "https://www.chatboc.ar";
  var position = getAttr(script, "position") || "right";

  if (!tenant) {
    console.error("[Chatboc] Falta data-tenant");
    return;
  }

  var iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.bottom = "24px";
  iframe.style[position] = "24px";
  iframe.style.width = "380px";
  iframe.style.height = "640px";
  iframe.style.border = "0";
  iframe.style.zIndex = "2147483647";
  iframe.style.borderRadius = "16px";
  iframe.style.boxShadow = "0 18px 60px rgba(0,0,0,.2)";
  iframe.allow = "microphone; clipboard-read; clipboard-write";

  // Check if tenant is just a slug or a full URL
  var url = host + "/iframe?tenant=" + encodeURIComponent(tenant);
  if (entityToken) url += "&entityToken=" + encodeURIComponent(entityToken);
  url += "&origin=" + encodeURIComponent(window.location.origin);

  iframe.src = url;
  document.body.appendChild(iframe);

  // postMessage (opcional)
  window.addEventListener("message", function (ev) {
    // Podés validar ev.origin === host
    if (!ev.data || !ev.data.type) return;
    if (ev.data.type === "CHATBOC_RESIZE") {
      if (ev.data.width) iframe.style.width = ev.data.width + "px";
      if (ev.data.height) iframe.style.height = ev.data.height + "px";
    }
  });
})();
