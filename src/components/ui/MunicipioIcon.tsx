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
      <polygon
        points="32,8 4,28 60,28"
        className="fill-blue-600 dark:fill-blue-400"
      />
      {/* Base y columnas (edificio) */}
      <rect
        x="10"
        y="28"
        width="44"
        height="22"
        rx="5"
        className="fill-blue-500 dark:fill-blue-300"
      />
      <rect x="17" y="36" width="5" height="14" rx="2.5" className="fill-white dark:fill-slate-900" />
      <rect x="26" y="36" width="5" height="14" rx="2.5" className="fill-white dark:fill-slate-900" />
      <rect x="35" y="36" width="5" height="14" rx="2.5" className="fill-white dark:fill-slate-900" />
      <rect x="44" y="36" width="5" height="14" rx="2.5" className="fill-white dark:fill-slate-900" />
      {/* Puerta */}
      <rect
        x="30"
        y="44"
        width="4"
        height="6"
        rx="2"
        className="fill-blue-800 dark:fill-blue-600"
      />
      {/* Base sólida */}
      <rect
        x="8"
        y="50"
        width="48"
        height="4"
        rx="2"
        className="fill-blue-800 dark:fill-blue-600"
      />
      {/* Escudo sencillo */}
      <circle
        cx="32"
        cy="18"
        r="4"
        className="fill-white stroke-blue-800 dark:stroke-blue-500"
        strokeWidth="2"
      />
    </svg>
  );
}
