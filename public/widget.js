(function () {
  const script = document.currentScript;
  const token = script.getAttribute("data-token") || "demo-anon";

  const iframe = document.createElement("iframe");
  iframe.src = `https://chatboc.ar/iframe?token=${token}`;
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

  document.body.appendChild(iframe);
})();
