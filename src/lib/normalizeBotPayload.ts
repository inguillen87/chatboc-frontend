export type ChatMsg = {
  id: string;
  role: "bot" | "user";
  type: "text" | "list";
  text?: string;
  items?: { id: string; title: string; desc?: string }[];
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function normalizeBotPayload(p: any): ChatMsg[] {
  if (!p) return [];

  // 1) texto principal
  const text =
    p.message_to_user ||
    p.message_body ||
    p.respuesta ||
    p.text ||
    "";

  // 2) listas (tu backend manda options_list)
  const options = p.options_list || p.options || p.botones || [];

  const out: ChatMsg[] = [];

  if (text.trim()) {
    out.push({ id: uid(), role: "bot", type: "text", text: text.trim() });
  }

  if (Array.isArray(options) && options.length > 0) {
    const items = options.map((o: any, idx: number) => ({
      id: String(o.id || o.value || idx + 1),
      title: String(o.title || o.label || o.text || `Opción ${idx + 1}`),
      desc: o.desc ? String(o.desc) : undefined
    }));
    out.push({ id: uid(), role: "bot", type: "list", items });
  }

  // 🔥 Garantía: nunca devolvemos 0 si hay algo útil
  return out.length ? out : [{ id: uid(), role: "bot", type: "text", text: "OK." }];
}
