import { useEffect, useState } from "react";

export type Prefs = {
  dyslexia: boolean;
  simplified: boolean;
};

const LS_KEY = "chatboc_accessibility";

export default function AccessibilityToggle({
  onChange,
}: {
  onChange?: (p: Prefs) => void;
}) {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem(LS_KEY) || "") || {
          dyslexia: false,
          simplified: true,
        }
      );
    } catch {
      return { dyslexia: false, simplified: true };
    }
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    onChange?.(prefs);
    const root = document.documentElement;
    root.classList.toggle("a11y-dyslexia", !!prefs.dyslexia);
    root.classList.toggle("a11y-simplified", !!prefs.simplified);
  }, [prefs, onChange]);

  return (
    <div className="flex items-center gap-1">
      <button
        className={`px-2 py-1 rounded text-xs border ${
          prefs.dyslexia ? "bg-amber-100" : "bg-white"
        }`}
        onClick={() => setPrefs((p) => ({ ...p, dyslexia: !p.dyslexia }))}
        aria-pressed={prefs.dyslexia}
        title="Modo Dislexia"
      >
        Dislexia
      </button>
      <button
        className={`px-2 py-1 rounded text-xs border ${
          prefs.simplified ? "bg-amber-100" : "bg-white"
        }`}
        onClick={() => setPrefs((p) => ({ ...p, simplified: !p.simplified }))}
        aria-pressed={prefs.simplified}
        title="Texto simplificado"
      >
        Simple
      </button>
    </div>
  );
}

