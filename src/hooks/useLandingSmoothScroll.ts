import { useEffect } from 'react';

/**
 * Inertial smooth scroll (Lenis) for the public landing only.
 *
 * Off with reduced motion, on touch screens (their native scroll is already
 * smooth) and inside dialogs, chats or anything marked `data-lenis-prevent`.
 * Lenis is a separate chunk loaded after the page is interactive.
 */
export function useLandingSmoothScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    let cancelled = false;
    let frame = 0;
    let lenis: { raf: (time: number) => void; destroy: () => void } | null = null;

    import('lenis')
      .then(({ default: Lenis }) => {
        if (cancelled) return;
        lenis = new Lenis({
          lerp: 0.12,
          wheelMultiplier: 1,
          prevent: (node: HTMLElement) =>
            Boolean(node.closest('[data-lenis-prevent], [role="dialog"], [role="listbox"], iframe, textarea')),
        });
        const loop = (time: number) => {
          lenis?.raf(time);
          frame = window.requestAnimationFrame(loop);
        };
        frame = window.requestAnimationFrame(loop);
      })
      .catch(() => {
        /* Native scroll stays. */
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, [enabled]);
}
