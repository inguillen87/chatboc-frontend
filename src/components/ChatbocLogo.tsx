import React from "react";

interface ChatbocLogoProps {
  size?: number;
  className?: string;
}

const ChatbocLogo: React.FC<ChatbocLogoProps> = ({ size = 36, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Fondo redondeado */}
      <rect width="100" height="100" rx="20" fill="#0EA5E9" />

      {/* Ojos */}
      <circle cx="35" cy="38" r="6" fill="white" />
      <circle cx="65" cy="38" r="6" fill="white" />

      {/* Sonrisa */}
      <path
        d="M35 60 C45 75, 55 75, 65 60"
        stroke="white"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default ChatbocLogo;
