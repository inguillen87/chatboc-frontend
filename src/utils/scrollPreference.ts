export const preferredScrollBehavior = (): ScrollBehavior =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "smooth"
    : "auto";
