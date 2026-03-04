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

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      setCanRender(false);
      return;
    }

    const update = () => {
      const { width, height } = node.getBoundingClientRect();
      const hasValidDimensions = width > 24 && height > 24;
      setCanRender(hasValidDimensions);
    };

    if (typeof ResizeObserver === 'undefined') {
      update();
      return;
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [renderWhenVisible]);

  return (
    <div ref={containerRef} className={className} style={{ minWidth, minHeight, width: '100%', height: '100%' }}>
      {canRender ? children : <div className="h-full w-full" />}
    </div>
  );
}
