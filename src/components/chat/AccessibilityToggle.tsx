import { useEffect, useState } from "react";
import { WholeWord, List } from "lucide-react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

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
        JSON.parse(safeLocalStorage.getItem(LS_KEY) || "") || {
          dyslexia: false,
          simplified: true,
        }
      );
    } catch {
      return { dyslexia: false, simplified: true };
    }
  });

  useEffect(() => {
    safeLocalStorage.setItem(LS_KEY, JSON.stringify(prefs));
    onChange?.(prefs);
    const root = document.documentElement;
    root.classList.toggle("a11y-dyslexia", !!prefs.dyslexia);
    root.classList.toggle("a11y-simplified", !!prefs.simplified);
  }, [prefs, onChange]);

  return (
    <div className="flex items-center gap-1">
      <button
        className={`h-8 px-2 flex items-center gap-1 rounded border text-xs ${
          prefs.dyslexia ? "bg-amber-100" : "bg-white"
        }`}
        onClick={() => setPrefs((p) => ({ ...p, dyslexia: !p.dyslexia }))}
        aria-pressed={prefs.dyslexia}
        aria-label="Modo Dislexia"
        title="Modo Dislexia"
      >
        <WholeWord className="w-4 h-4" />
        <span>Dislexia</span>
      </button>
      <button
        className={`h-8 px-2 flex items-center gap-1 rounded border text-xs ${
          prefs.simplified ? "bg-amber-100" : "bg-white"
        }`}
        onClick={() => setPrefs((p) => ({ ...p, simplified: !p.simplified }))}
        aria-pressed={prefs.simplified}
        aria-label="Texto simplificado"
        title="Texto simplificado"
      >
        <List className="w-4 h-4" />
        <span>Simple</span>
      </button>
    </div>
  );
}

