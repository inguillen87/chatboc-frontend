const WIDGET_MODE_FLAG = "__CHATBOC_WIDGET_MODE__";
const WIDGET_MODE_COUNT = "__CHATBOC_WIDGET_MODE_COUNT__";

function getWindow(): any | null {
  if (typeof window === "undefined") return null;
  return window as any;
}

export function isWidgetModeActive(): boolean {
  const w = getWindow();
  return !!(w && w[WIDGET_MODE_FLAG]);
}

export function activateWidgetMode() {
  const w = getWindow();
  if (!w) return;
  const current = Number(w[WIDGET_MODE_COUNT] || 0) + 1;
  w[WIDGET_MODE_COUNT] = current;
  w[WIDGET_MODE_FLAG] = true;
}

export function deactivateWidgetMode() {
  const w = getWindow();
  if (!w) return;
  const current = Number(w[WIDGET_MODE_COUNT] || 0);
  const next = current - 1;
  if (next <= 0) {
    delete w[WIDGET_MODE_FLAG];
    delete w[WIDGET_MODE_COUNT];
  } else {
    w[WIDGET_MODE_COUNT] = next;
  }
}
