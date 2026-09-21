import { useLayoutEffect, type RefObject } from 'react';

const PROPERTY = '--chatboc-fixed-header-height';

/** Reserve the actual fixed header height, including responsive branding and safe areas. */
export function useFixedHeaderOffset(ref: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const header = ref.current;
    if (!header) return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue(PROPERTY);
    let written = '';
    const measure = () => {
      const height = header.getBoundingClientRect().height;
      if (!Number.isFinite(height) || height < 0) return;
      written = `${Math.ceil(height)}px`;
      if (root.style.getPropertyValue(PROPERTY) !== written) root.style.setProperty(PROPERTY, written);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(header); window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', measure);
      if (root.style.getPropertyValue(PROPERTY) === written) {
        if (previous) root.style.setProperty(PROPERTY, previous); else root.style.removeProperty(PROPERTY);
      }
    };
  }, [ref]);
}
