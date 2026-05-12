import { useEffect, useState } from "react";

export default function ReadingRuler() {
  const [y, setY] = useState(() =>
    typeof window === "undefined" ? 120 : Math.round(window.innerHeight / 2),
  );

  useEffect(() => {
    const handlePointer = (event: PointerEvent) => setY(event.clientY);
    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const rect = target?.getBoundingClientRect?.();
      if (rect && Number.isFinite(rect.top)) {
        setY(Math.round(rect.top + rect.height / 2));
      }
    };

    window.addEventListener("pointermove", handlePointer, { passive: true });
    window.addEventListener("focusin", handleFocus);
    return () => {
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("focusin", handleFocus);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 z-[1000000]"
      style={{
        top: y - 20,
        height: 40,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.12)",
        transition: "top 60ms",
      }}
    />
  );
}
