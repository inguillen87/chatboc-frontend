import { useEffect } from 'react';

type HotkeyCallback = (event: KeyboardEvent) => void;
type HotkeysMap = Record<string, HotkeyCallback>;

export const useHotkeys = (hotkeys: HotkeysMap, deps: any[] = []) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Evitar que los atajos se disparen si se está escribiendo en un input, textarea, etc.
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      const key = event.key.toLowerCase();

      // Construir una clave para el mapa de atajos (ej. "ctrl+s", "n")
      let hotkey = '';
      if (event.ctrlKey) hotkey += 'ctrl+';
      if (event.altKey) hotkey += 'alt+';
      if (event.shiftKey) hotkey += 'shift+';
      hotkey += key;

      if (hotkeys[hotkey]) {
        event.preventDefault();
        hotkeys[hotkey](event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hotkeys, ...deps]);
};
