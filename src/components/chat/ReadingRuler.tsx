import { useEffect, useState } from "react";

export default function ReadingRuler() {
  const [y, setY] = useState(0);

  useEffect(() => {
    const h = (e: MouseEvent) => setY(e.clientY);
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0"
      style={{ top: y - 18, height: 36, boxShadow: "0 0 0 9999px rgba(0,0,0,0.12)", transition: "top 60ms" }}
    />
  );
}

