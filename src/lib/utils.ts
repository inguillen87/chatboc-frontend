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

export function normalizePhoneNumberForWhatsApp(phoneNumber: string): string {
  if (!phoneNumber) return "";
  // Remove non-digit characters
  let normalized = phoneNumber.replace(/\D/g, "");
  // Remove leading '+' if present, as wa.me usually handles this
  // or it might interfere if the number already includes a country code.
  // It's generally better to ensure the number IS international and includes the country code without the '+'.
  // For example, '54911...' for an Argentine mobile.
  // The wa.me link itself will correctly interpret '54911...' as +54 9 11...

  // If it starts with '+', remove it.
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }

  // If it starts with '00' (common international prefix), remove it.
  // Assumes country code will follow.
  if (normalized.startsWith('00')) {
    normalized = normalized.substring(2);
  }

  // Example: If it's a 10-digit Argentine number without +549, add it.
  // This is highly specific and should be adapted or made more robust.
  // For a generic solution, this part might be removed or made configurable.
  // if (normalized.length === 10 && !normalized.startsWith('549')) {
  //  normalized = `549${normalized}`;
  // }

  return normalized;
}
