import { useEffect, useState, type CSSProperties } from "react";

export interface VisualViewportMetrics {
  layoutHeight: number;
  viewportHeight: number;
  viewportWidth: number;
  offsetTop: number;
  offsetLeft: number;
}

const KEYBOARD_HEIGHT_THRESHOLD_PX = 80;

export const isMobileKeyboardViewport = (metrics: VisualViewportMetrics | null): boolean => {
  if (!metrics) return false;
  if (metrics.viewportHeight <= 0) return false;
  const occludedHeight = Math.max(
    0,
    Math.round(metrics.layoutHeight - metrics.viewportHeight - metrics.offsetTop),
  );
  if (occludedHeight >= KEYBOARD_HEIGHT_THRESHOLD_PX) return true;
  if (metrics.offsetTop > 0 && metrics.viewportHeight < metrics.layoutHeight) return true;
  return false;
};

export const resolveMobileOpenViewportStyle = (
  metrics: VisualViewportMetrics | null,
  fallback: CSSProperties,
): CSSProperties => {
  if (!metrics || !isMobileKeyboardViewport(metrics)) {
    return fallback;
  }

  const heightPx = `${Math.round(metrics.viewportHeight)}px`;
  const widthPx = metrics.viewportWidth > 0 ? `${Math.round(metrics.viewportWidth)}px` : fallback.width;
  const offsetTopPx = `${Math.max(0, Math.round(metrics.offsetTop))}px`;
  const offsetLeftPx = `${Math.max(0, Math.round(metrics.offsetLeft))}px`;

  return {
    ...fallback,
    top: offsetTopPx,
    left: offsetLeftPx,
    right: "auto",
    bottom: "auto",
    width: widthPx,
    height: heightPx,
    maxWidth: widthPx,
    maxHeight: heightPx,
  };
};

const readVisualViewportMetrics = (): VisualViewportMetrics | null => {
  if (typeof window === "undefined" || !window.visualViewport) return null;
  const vv = window.visualViewport;
  const layoutHeight = Math.max(
    window.innerHeight || 0,
    typeof document !== "undefined" ? document.documentElement?.clientHeight || 0 : 0,
  );
  return {
    layoutHeight,
    viewportHeight: vv.height,
    viewportWidth: vv.width,
    offsetTop: vv.offsetTop,
    offsetLeft: vv.offsetLeft,
  };
};

export const useMobileVisualViewport = (active: boolean) => {
  const [metrics, setMetrics] = useState<VisualViewportMetrics | null>(() =>
    active ? readVisualViewportMetrics() : null,
  );

  useEffect(() => {
    if (!active || typeof window === "undefined" || !window.visualViewport) {
      setMetrics(null);
      return undefined;
    }

    const vv = window.visualViewport;
    const sync = () => {
      const next = readVisualViewportMetrics();
      setMetrics((prev) => {
        if (
          prev &&
          next &&
          Math.round(prev.layoutHeight) === Math.round(next.layoutHeight) &&
          Math.round(prev.viewportHeight) === Math.round(next.viewportHeight) &&
          Math.round(prev.viewportWidth) === Math.round(next.viewportWidth) &&
          Math.round(prev.offsetTop) === Math.round(next.offsetTop) &&
          Math.round(prev.offsetLeft) === Math.round(next.offsetLeft)
        ) {
          return prev;
        }
        return next;
      });
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [active]);

  return {
    metrics,
    isKeyboardOpen: isMobileKeyboardViewport(metrics),
  };
};
