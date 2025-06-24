import React from "react";

export default function MunicipioIcon({
  className = "w-7 h-7",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Base del edificio */}
      <rect x="3" y="9" width="18" height="11" rx="2.5" fill="none" />
      {/* Techo */}
      <polygon points="12,3 2,9 22,9" fill="none" />
      {/* Puerta */}
      <rect x="10" y="14" width="4" height="6" rx="1" />
      {/* Columnas */}
      <line x1="6.5" y1="12" x2="6.5" y2="18" />
      <line x1="17.5" y1="12" x2="17.5" y2="18" />
      {/* Ventanas */}
      <circle cx="8.5" cy="12.7" r="0.8" />
      <circle cx="15.5" cy="12.7" r="0.8" />
      {/* Campanario */}
      <circle cx="12" cy="7" r="1.1" />
    </svg>
  );
}
