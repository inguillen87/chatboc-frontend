import { useEffect, useState } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = safeLocalStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return stored === "dark" || (!stored && prefersDark);
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const isDarkMode = document.documentElement.classList.contains("dark");
      setIsDark(isDarkMode);
    };

    window.addEventListener("themechange", handleThemeChange);
    // The host navbar updates the real root class without emitting an event.
    // A mounted (including closed) widget must follow that same source of truth.
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Initial check
    handleThemeChange();

    return () => {
      observer.disconnect();
      window.removeEventListener("themechange", handleThemeChange);
    };
  }, []);

  return isDark;
}
