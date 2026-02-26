import { useEffect, useRef, useState } from 'react';

interface ChartMountProps {
  className?: string;
  minWidth?: number;
  minHeight?: number;
  children: React.ReactNode;
}

export default function ChartMount({
  className,
  minWidth = 280,
  minHeight = 220,
  children,
}: ChartMountProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      setIsReady(rect.width >= minWidth && rect.height >= minHeight);
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      setIsReady(true);
      return;
    }

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [minHeight, minWidth]);

  return (
    <div ref={containerRef} className={className}>
      {isReady ? children : <div className="h-full w-full min-h-[220px]" />}
    </div>
  );
}
