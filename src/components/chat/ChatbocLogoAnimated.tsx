// src/components/chat/ChatbocLogoAnimated.tsx

import React from "react";

const ChatbocLogoAnimated = ({
  size = 48,
  smiling = false,
  movingEyes = false,
  style = {},
}) => {
  // Ajusta los valores para que coincidan con tu logo si lo ves raro
  const leftEye = movingEyes ? 20 : 18;
  const rightEye = movingEyes ? 36 : 34;
  const mouthPath = smiling
    ? "M18,34 Q28,44 38,34"
    : "M20,34 Q28,38 36,34";

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-block",
        ...style,
      }}
    >
      <img
        src="/favicon/favicon-512x512.png"
        alt="Chatboc"
        style={{
          width: size,
          height: size,
          display: "block",
        }}
        draggable={false}
      />
      {/* Capa de animación SVG encima */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 56 56"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {/* Ojos */}
        <circle cx={leftEye} cy="24" r="4" fill="#fff" />
        <circle cx={rightEye} cy="24" r="4" fill="#fff" />
        {/* Boca */}
        <path
          d={mouthPath}
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          style={{ transition: "d 0.25s" }}
        />
      </svg>
    </div>
  );
};

export default ChatbocLogoAnimated;
