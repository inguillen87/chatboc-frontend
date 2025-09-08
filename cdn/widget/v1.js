(function () {
  console.log("Chatboc widget v1");
  const S = document.currentScript;
  const API = (S?.dataset?.apiBase || "https://chatboc.ar").replace(/\/+$/, "");
  const OWNER = S?.dataset?.ownerToken || "";
  let token = null, timer = null;

  function decode(t) {
    try {
      const p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(p));
    } catch { return {}; }
  }

  async function mint() {
    const r = await fetch(API + "/auth/widget-token", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, OWNER ? { "Authorization": OWNER } : {}),
      body: "{}"
    });
    const j = await r.json();
    if (!r.ok || !j.token) throw new Error("mint_failed");
    return j.token;
  }

  async function refresh(old) {
    const r = await fetch(API + "/auth/widget-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: old })
    });
    const j = await r.json();
    if (!r.ok || !j.token) throw new Error("refresh_failed");
    return j.token;
  }

  function schedule(t) {
    const { exp } = decode(t), now = Math.floor(Date.now() / 1000);
    const secs = (exp || 0) - now, wait = Math.max(secs - 120, 15) * 1000;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        token = await refresh(token);
      } catch {
        try {
          token = await mint();
        } catch {
          schedule(token);
          return;
        }
      }
      schedule(token);
    }, wait);
  }

  async function ensureToken() {
    if (!token) { token = await mint(); schedule(token); }
    return token;
  }

  async function apiFetch(url, init) {
    const t = await ensureToken();
    const opts = Object.assign({}, init || {}, {
      headers: Object.assign({}, (init && init.headers) || {}, { "Authorization": "Bearer " + t })
    });
    return fetch(url, opts);
  }

  window.chatbocAuth = { ensureToken, apiFetch };
})();

