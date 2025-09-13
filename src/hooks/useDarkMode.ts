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

    // Initial check
    handleThemeChange();

    return () => {
      window.removeEventListener("themechange", handleThemeChange);
    };
  }, []);

  return isDark;
}
