import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name?: string): string {
  if (!name || name.trim() === "") return ""; // Devuelve cadena vacía si no hay nombre o está vacío
  const names = name.trim().split(/\s+/);

  if (names.length === 1 && names[0].length > 0) {
    return names[0].substring(0, 2).toUpperCase(); // Hasta 2 letras del único nombre
  }

  return names
    .slice(0, 2) // Tomar solo los primeros dos nombres/palabras
    .map((n) => (n.length > 0 ? n[0] : "")) // Primera letra de cada uno
    .filter(char => char !== "") // Filtrar cadenas vacías si un "nombre" era solo espacios
    .join("")
    .toUpperCase();
}
