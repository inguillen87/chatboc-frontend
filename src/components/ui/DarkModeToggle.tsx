import { useEffect, useState } from "react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

const DarkModeToggle = () => {
  const [isDark, setIsDark] = useState(false);

  // Cargar preferencia desde localStorage o sistema
  useEffect(() => {
    const stored = safeLocalStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (stored === "dark" || (!stored && prefersDark)) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;

    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      safeLocalStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      html.classList.add("dark");
      safeLocalStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      title="Cambiar modo"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
};

export default DarkModeToggle;
