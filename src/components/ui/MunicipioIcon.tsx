import React from "react";

export default function MunicipioIcon({
  className = "w-12 h-12 md:w-16 md:h-16",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      {...props}
    >
      {/* Techo/triángulo central */}
      <polygon points="32,8 4,28 60,28" fill="#2563eb" />
      {/* Base y columnas (edificio) */}
      <rect x="10" y="28" width="44" height="22" rx="5" fill="#3b82f6" />
      <rect x="17" y="36" width="5" height="14" rx="2.5" fill="#fff" />
      <rect x="26" y="36" width="5" height="14" rx="2.5" fill="#fff" />
      <rect x="35" y="36" width="5" height="14" rx="2.5" fill="#fff" />
      <rect x="44" y="36" width="5" height="14" rx="2.5" fill="#fff" />
      {/* Puerta */}
      <rect x="30" y="44" width="4" height="6" rx="2" fill="#1e40af" />
      {/* Base sólida */}
      <rect x="8" y="50" width="48" height="4" rx="2" fill="#1e40af" />
      {/* Escudo sencillo */}
      <circle
        cx="32"
        cy="18"
        r="4"
        fill="#fff"
        stroke="#1e40af"
        strokeWidth="2"
      />
    </svg>
  );
}
