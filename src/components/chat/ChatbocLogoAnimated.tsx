import React, { useEffect, useRef, useState } from "react";

interface Props {
  size?: number;
  mouth?: "normal" | "smile" | "open";
  theme?: "dark" | "light";
  isThinking?: boolean;
  style?: React.CSSProperties;
}

export const ChatbocLogoAnimated: React.FC<Props> = ({
  size = 64,
  mouth = "normal",
  theme = "dark",
  isThinking = false,
  style = {},
}) => {
  const [blink, setBlink] = useState(false);
  const [shineX, setShineX] = useState(38);
  const [eyeOffset, setEyeOffset] = useState(0);
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Parpadeo natural
  useEffect(() => {
    let t: any;
    function blinkLoop() {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 110 + Math.random() * 60);
        blinkLoop();
      }, 1800 + Math.random() * 1600);
    }
    blinkLoop();
    return () => clearTimeout(t);
  }, []);

  // Brillo móvil animado
  useEffect(() => {
    let t: any, x = 38, dx = -0.55;
    function animateShine() {
      if (x < 28) dx = 0.55;
      if (x > 41) dx = -0.55;
      x += dx;
      setShineX(x);
      t = setTimeout(animateShine, 36);
    }
    animateShine();
    return () => clearTimeout(t);
  }, []);

  // Mirada que sigue el mouse
  useEffect(() => {
    function handle(e: MouseEvent) {
      const center = window.innerWidth / 2;
      const diff = Math.max(Math.min((e.clientX - center) / 60, 2), -2);
      setEyeOffset(diff);
    }
    window.addEventListener("mousemove", handle);
    return () => window.removeEventListener("mousemove", handle);
  }, []);

  // Boca
  let mouthPath, mouthFill, mouthStroke;
  if (mouth === "smile") {
    mouthPath = "M22 38 Q30 46 38 38";
    mouthFill = "none";
    mouthStroke = "#fff";
  } else if (mouth === "open") {
    mouthPath = "M24 38 Q30 49 36 38 Q30 45 24 38 Z";
    mouthFill = "#fff";
    mouthStroke = "#fff";
  } else {
    mouthPath = "M24 37 Q30 43 36 37";
    mouthFill = "none";
    mouthStroke = "#fff";
  }

  // Colores modo dark/light
  const bgColor = theme === "dark" ? "#238fff" : "#1970d1";
  const mainBg = theme === "dark" ? "#181f2a" : "#fff";
  const borderColor = theme === "dark" ? "#172133" : "#ddd";
  const shadow = theme === "dark"
    ? "0 6px 32px rgba(0,0,0,.30)"
    : "0 4px 16px rgba(30,72,120,.08)";

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "inline-block",
        filter: isThinking ? "brightness(1.08) drop-shadow(0 0 6px #00f5d4bb)" : undefined,
        transition: "filter .25s",
        ...style,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 60 60" fill="none" style={{ display: "block" }}>
        {/* Fondo bocadillo */}
        <rect
          x="4"
          y="10"
          width="52"
          height="40"
          rx="13"
          fill={bgColor}
          filter="url(#shadow)"
        />
        {/* Piquito */}
        <polygon
          points="12,47 12,54 23,48"
          fill={bgColor}
          opacity={0.93}
        />
        {/* Ojitos */}
        <ellipse
          cx={22 + eyeOffset}
          cy="28"
          rx="4"
          ry={blink ? 0.85 : 3.1}
          fill="#fff"
        />
        <ellipse
          cx={38 + eyeOffset}
          cy="28"
          rx="4"
          ry={blink ? 0.85 : 3.1}
          fill="#fff"
        />
        {/* Pupilas */}
        <ellipse
          cx={22 + eyeOffset}
          cy={blink ? 29 : 28}
          rx="1.3"
          ry={blink ? 0.27 : 1.18}
          fill="#2271c7"
          opacity={blink ? 0.10 : 0.31}
        />
        <ellipse
          cx={38 + eyeOffset}
          cy={blink ? 29 : 28}
          rx="1.3"
          ry={blink ? 0.27 : 1.18}
          fill="#2271c7"
          opacity={blink ? 0.10 : 0.31}
        />
        {/* Boca */}
        <path
          d={mouthPath}
          stroke={mouthStroke}
          fill={mouthFill}
          strokeWidth={mouth === "open" ? 1.1 : 2.3}
          strokeLinecap="round"
          style={{ transition: "d .21s" }}
        />
        {/* Brillo animado */}
        <ellipse
          cx={shineX}
          cy="18"
          rx="7"
          ry="2.2"
          fill="#fff"
          opacity="0.13"
          style={{ transition: "cx .18s" }}
        />
        {/* Shadow */}
        <defs>
          <filter id="shadow" x="0" y="6" width="64" height="55" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#07285c" floodOpacity={theme === "dark" ? 0.25 : 0.11}/>
          </filter>
        </defs>
      </svg>
    </div>
  );
};
