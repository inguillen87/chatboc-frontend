import React, { useId } from "react";

export type BrandBotState = "idle" | "listening" | "thinking" | "speaking";

/** Draws the organization mascot; `still` is for repeated places (message history). */
export type RenderBrandAvatar = (state: BrandBotState, size: number, still?: boolean) => React.ReactNode;

export interface BrandBotAvatarProps {
  /** Organization palette (#RRGGBB), as published by the backend. */
  palette: string[];
  /** Optional mesh stops in the 0..1 box; without them the palette is spread over the corners. */
  gradientStops?: { color: string; x: number; y: number }[];
  /** Color for the eyes and mouth; defaults to a near-black slate. */
  faceColor?: string;
  state?: BrandBotState;
  size?: number | string;
  /** Accessible name. Without it the avatar is decorative. */
  title?: string;
  reducedMotion?: boolean;
  /**
   * Static copy for repeated places (one per message in the history): no
   * motion and no embedded stylesheet, so a long conversation does not carry
   * one copy of the rules per avatar.
   */
  still?: boolean;
  className?: string;
}

const CORNERS = [
  { x: 0.18, y: 0.18 },
  { x: 0.88, y: 0.12 },
  { x: 0.15, y: 0.88 },
  { x: 0.82, y: 0.85 },
  { x: 0.5, y: 0.5 },
  { x: 0.5, y: 0.05 },
];

// Motion rules travel inside the SVG: no extra stylesheet (and no extra
// offline-precache asset) for organizations that never use the mascot.
// The static look (size, shadow, hidden ring) lives in attributes, so a
// still avatar renders the same without these rules.
const BRAND_BOT_CSS = `.cbb .cbb-body { transform-box:fill-box; transform-origin:50% 60%; animation:cbb-float 3.4s ease-in-out infinite; }
.cbb .cbb-eye { transform-box:fill-box; transform-origin:center; animation:cbb-blink 4.2s ease-in-out infinite; }
.cbb .cbb-antenna-ring { transform-box:fill-box; transform-origin:center; }

.cbb[data-state="listening"] .cbb-eye { animation:none; transform:scale(1.12); }
.cbb[data-state="listening"] .cbb-antenna-ring { animation:cbb-ring 1.4s ease-out infinite; }

.cbb[data-state="thinking"] .cbb-eyes { transform:translateY(-1.6px); }
.cbb[data-state="thinking"] .cbb-eye { animation-duration:2.6s; }
.cbb .cbb-dot { transform-box:fill-box; transform-origin:center; animation:cbb-bounce 1.05s ease-in-out infinite; }
.cbb .cbb-dot-1 { animation-delay:.15s; }
.cbb .cbb-dot-2 { animation-delay:.3s; }

.cbb .cbb-mouth-open { transform-box:fill-box; transform-origin:center; animation:cbb-talk .42s ease-in-out infinite alternate; }

@keyframes cbb-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-1.6px); } }
@keyframes cbb-blink { 0%,92%,100% { transform:scaleY(1); } 95% { transform:scaleY(0.12); } }
@keyframes cbb-ring { 0% { opacity:.85; transform:scale(1); } 100% { opacity:0; transform:scale(2.6); } }
@keyframes cbb-bounce { 0%,100% { transform:translateY(0); opacity:.75; } 45% { transform:translateY(-2.6px); opacity:1; } }
@keyframes cbb-talk { from { transform:scaleY(.35); } to { transform:scaleY(1); } }

.cbb[data-reduced-motion="true"] *,
.cbb[data-reduced-motion="true"] { animation:none !important; }
@media (prefers-reduced-motion: reduce) {
  .cbb, .cbb * { animation:none !important; }
}`;

const SVG_STYLE: React.CSSProperties = {
  display: "block",
  overflow: "visible",
  filter: "drop-shadow(0 6px 10px rgb(2 6 23 / 0.28))",
};

// The head is a speech bubble ("globa") with its tail at the bottom left.
const HEAD_PATH =
  "M22 7h20c9.4 0 17 7.6 17 17v8c0 9.4-7.6 17-17 17H27.5l-11.2 8.1c-1.3.9-3-.2-2.7-1.7l1.4-7.4C9.6 45.6 5 39.4 5 32v-8C5 14.6 12.6 7 22 7z";

/**
 * Original animated mascot drawn with the organization's palette. It never
 * reuses or alters an organization's logo: only its colors. States: idle
 * (floats and blinks), listening, thinking and speaking. With reduced motion
 * it stays still.
 */
const BrandBotAvatar: React.FC<BrandBotAvatarProps> = ({
  palette,
  gradientStops,
  faceColor = "#0F172A",
  state = "idle",
  size = 40,
  title,
  reducedMotion = false,
  still = false,
  className,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const colors = palette.length ? palette : ["#2563EB", "#0F766E"];
  const stops = gradientStops?.length
    ? gradientStops
    : colors.slice(0, 4).map((color, index) => ({ color, ...CORNERS[index] }));
  const accent = colors[Math.min(3, colors.length - 1)];
  const cheek = colors[Math.min(1, colors.length - 1)];
  const dots = [colors[0], colors[Math.min(2, colors.length - 1)], accent];
  const clipId = `cbb-clip-${uid}`;
  const label = title?.trim();

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={["cbb", className].filter(Boolean).join(" ")}
      data-state={state}
      style={SVG_STYLE}
      data-reduced-motion={reducedMotion || still ? "true" : undefined}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {still ? null : <style>{BRAND_BOT_CSS}</style>}
      <defs>
        <clipPath id={clipId}>
          <path d={HEAD_PATH} />
        </clipPath>
        {stops.map((stop, index) => (
          <radialGradient key={index} id={`cbb-g${index}-${uid}`} cx={stop.x} cy={stop.y} r="0.75" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor={stop.color} stopOpacity="1" />
            <stop offset="0.55" stopColor={stop.color} stopOpacity="0.55" />
            <stop offset="1" stopColor={stop.color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <g className="cbb-body">
        <g className="cbb-antenna">
          <line x1="32" y1="7.5" x2="32" y2="2.8" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
          <circle className="cbb-antenna-dot" cx="32" cy="2.8" r="2.4" fill={accent} />
          <circle className="cbb-antenna-ring" cx="32" cy="2.8" r="2.4" fill="none" stroke={accent} strokeWidth="1.2" opacity="0" />
        </g>
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="64" height="64" fill={stops[0].color} />
          {stops.map((_, index) => (
            <rect key={index} x="0" y="0" width="64" height="64" fill={`url(#cbb-g${index}-${uid})`} />
          ))}
          <path d="M12 16c4-6 10-8 18-8" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
        <path d={HEAD_PATH} fill="none" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.4" />
        <rect x="14" y="16" width="36" height="25" rx="11" fill="#FFFFFF" fillOpacity="0.95" />
        <g className="cbb-eyes" fill={faceColor}>
          <ellipse className="cbb-eye" cx="25" cy="27" rx="3.1" ry="3.9" />
          <ellipse className="cbb-eye" cx="39" cy="27" rx="3.1" ry="3.9" />
        </g>
        <circle cx="20.5" cy="33.5" r="2.3" fill={cheek} opacity="0.45" />
        <circle cx="43.5" cy="33.5" r="2.3" fill={cheek} opacity="0.45" />
        {state === "thinking" ? (
          <g className="cbb-dots">
            {dots.map((color, index) => (
              <circle key={index} className={`cbb-dot cbb-dot-${index}`} cx={26 + index * 6} cy="35" r="1.9" fill={color} />
            ))}
          </g>
        ) : state === "speaking" ? (
          <ellipse className="cbb-mouth-open" cx="32" cy="35" rx="3.6" ry="2.6" fill={faceColor} />
        ) : (
          <path className="cbb-smile" d="M27 33.5q5 4.6 10 0" stroke={faceColor} strokeWidth="2.3" strokeLinecap="round" fill="none" />
        )}
      </g>
    </svg>
  );
};

export default BrandBotAvatar;
