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
  renderWhenVisible = false,
  children,
}: MeasuredContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
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
      setCanRender(false);
      return;
    }

    const update = () => {
      const { width, height } = node.getBoundingClientRect();
      const styles = window.getComputedStyle(node);
      const isVisible = styles.display !== 'none' && styles.visibility !== 'hidden';
      const hasValidDimensions = isVisible && width > 24 && height > 24;
      setCanRender(hasValidDimensions);
    };

    if (!isInViewport) {
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
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [isInViewport, renderWhenVisible]);

  return (
    <div ref={containerRef} className={className} style={{ minWidth, minHeight, width: '100%', height: '100%' }}>
      {canRender ? children : <div className="h-full w-full" />}
    </div>
  );
}
