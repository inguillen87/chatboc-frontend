import { type ReactNode, useEffect, useRef, useState } from 'react';

interface MeasuredContainerProps {
  className?: string;
  minWidth?: number;
  minHeight?: number;
  renderWhenVisible?: boolean;
  children: ReactNode;
}

export function MeasuredContainer({
  className,
  minWidth = 280,
  minHeight = 220,
  renderWhenVisible = true,
  children,
}: MeasuredContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const validMeasurementsRef = useRef(0);
  const [canRender, setCanRender] = useState(false);
  const [isInViewport, setIsInViewport] = useState(!renderWhenVisible);

  useEffect(() => {
    if (!renderWhenVisible) {
      setIsInViewport(true);
      return;
    }
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const next = entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0);
        setIsInViewport(next);
      },
      { root: null, threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [renderWhenVisible]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      validMeasurementsRef.current = 0;
      setCanRender(false);
      return;
    }

    const update = () => {
      const { width, height } = node.getBoundingClientRect();
      const styles = window.getComputedStyle(node);
      const isVisible = styles.display !== 'none' && styles.visibility !== 'hidden';
      const minValidWidth = Math.max(24, Math.min(minWidth, 120));
      const minValidHeight = Math.max(24, Math.min(minHeight, 120));
      const hasValidDimensions = isVisible && width >= minValidWidth && height >= minValidHeight;
      if (!hasValidDimensions) {
        validMeasurementsRef.current = 0;
        setCanRender(false);
        return;
      }
      validMeasurementsRef.current += 1;
      setCanRender(validMeasurementsRef.current >= 2);
    };

    if (!isInViewport) {
      validMeasurementsRef.current = 0;
      setCanRender(false);
      return;
    }

    if (typeof ResizeObserver === 'undefined') {
      update();
      return;
    }

    const raf = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(node);

    const mutationTargets: HTMLElement[] = [];
    let current: HTMLElement | null = node;
    while (current && current !== document.body) {
      mutationTargets.push(current);
      current = current.parentElement;
    }
    if (document.body) {
      mutationTargets.push(document.body);
    }

    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => {
            update();
          })
        : null;

    mutationTargets.forEach((target) => {
      mutationObserver?.observe(target, {
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'],
      });
    });

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      mutationObserver?.disconnect();
    };
  }, [isInViewport, minHeight, minWidth, renderWhenVisible]);

  return (
    <div ref={containerRef} className={className} style={{ minWidth, minHeight, width: '100%', height: '100%' }}>
      {canRender ? children : <div className="h-full w-full" />}
    </div>
  );
}
