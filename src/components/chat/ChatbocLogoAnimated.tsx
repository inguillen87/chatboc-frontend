// ChatbocLogoAnimated.tsx
import React from "react";

// Estado: normal / smile / open (boquita abierta para "pensar")
export const ChatbocLogoAnimated = ({
  size = 62,
  mouth = "normal", // "normal", "smile", "open"
  className = "",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 128 128"
    className={className}
    style={{ display: "block" }}
    fill="none"
  >
    {/* Burbuja fondo */}
    <rect
      x="14"
      y="14"
      width="100"
      height="86"
      rx="22"
      fill="#238fff"
    />
    {/* Cola chat */}
    <polygon points="46,100 56,114 66,100" fill="#238fff" />
    {/* Ojos */}
    <circle cx="47" cy="54" r="8" fill="#fff" />
    <circle cx="81" cy="54" r="8" fill="#fff" />
    {/* Boca animable */}
    {mouth === "smile" ? (
      <path d="M48 80 Q64 95 80 80" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" />
    ) : mouth === "open" ? (
      <ellipse cx="64" cy="82" rx="16" ry="9" fill="#fff" />
    ) : (
      <path d="M52 80 Q64 87 76 80" stroke="#fff" strokeWidth="5.2" strokeLinecap="round" fill="none" />
    )}
  </svg>
);
