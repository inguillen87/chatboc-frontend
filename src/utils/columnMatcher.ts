/**
 * Normalizes a string for comparison by converting to lowercase and removing non-alphanumeric characters.
 * @param str The string to normalize.
 * @returns The normalized string.
 */
function normalizeString(str: string): string {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Calculates the Levenshtein distance between two strings.
 * @param s1 The first string.
 * @param s2 The second string.
 * @returns The Levenshtein distance.
 */
function levenshteinDistance(s1: string, s2: string): number {
  if (!s1) return s2 ? s2.length : 0;
  if (!s2) return s1.length;

  const matrix = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i += 1) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= s2.length; j += 1) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Calculates a similarity score between two strings based on Levenshtein distance.
 * Score is between 0 (completely different) and 1 (identical).
 * @param s1 The first string.
 * @param s2 The second string.
 * @returns The similarity score.
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const normalizedS1 = normalizeString(s1);
  const normalizedS2 = normalizeString(s2);

  if (normalizedS1 === "" && normalizedS2 === "") return 1;
  if (normalizedS1 === "" || normalizedS2 === "") return 0;

  const maxLength = Math.max(normalizedS1.length, normalizedS2.length);
  if (maxLength === 0) return 1; // Both are empty or became empty after normalization

  const distance = levenshteinDistance(normalizedS1, normalizedS2);
  return 1 - distance / maxLength;
}

export interface SystemField {
  key: string; // e.g., "product_name"
  label: string; // e.g., "Nombre del Producto"
  // Add other properties like 'required', 'type' if fetched from backend in future
}

export interface MatchedMapping {
  systemFieldKey: string;
  userColumn: string | null; // Name of the column from user's file
  similarity?: number; // Score of the match, if auto-detected
}

// Initial list of system fields (can be expanded or fetched from backend later)
// For now, keep it simple. In a real scenario, these would be more comprehensive
// and potentially configurable or fetched from an API.
export const DEFAULT_SYSTEM_FIELDS: SystemField[] = [
  { key: "nombre", label: "Nombre del Producto" },
  { key: "sku", label: "SKU / Código" },
  { key: "descripcion", label: "Descripción" },
  { key: "precio", label: "Precio" },
  { key: "stock", label: "Stock / Cantidad" },
  { key: "categoria", label: "Categoría" },
  { key: "marca", label: "Marca" },
  { key: "ean", label: "EAN / Código de Barras" },
  { key: "imagen_url", label: "URL de Imagen" },
  { key: "disponible", label: "Disponible (Sí/No)" },
];

const SIMILARITY_THRESHOLD = 0.45; // Adjusted after testing - provides a balance. Original was 0.6

/**
 * Suggests mappings from user columns to system fields.
 * @param userColumns List of column names from the user's file.
 * @param systemFields List of system field definitions.
 * @returns A list of suggested mappings.
 */
export function suggestMappings(
  userColumns: string[],
  systemFields: SystemField[] = DEFAULT_SYSTEM_FIELDS
): MatchedMapping[] {
  const suggestions: MatchedMapping[] = [];
  const usedUserColumns = new Set<string>();

  systemFields.forEach((systemField) => {
    let bestMatch: { userColumn: string; similarity: number } | null = null;

    userColumns.forEach((userColumn) => {
      if (usedUserColumns.has(userColumn)) {
        return; // Skip if this user column is already mapped
      }

      const similarity = calculateSimilarity(systemField.label, userColumn);
      // Also consider similarity with the key itself, e.g. if user column is "sku" and system key is "sku"
      const keySimilarity = calculateSimilarity(systemField.key, userColumn);

      const finalSimilarity = Math.max(similarity, keySimilarity);

      // console.log(`SysField: "${systemField.label}" (key: "${systemField.key}") vs UserCol: "${userColumn}" -> LabelSim: ${similarity.toFixed(3)}, KeySim: ${keySimilarity.toFixed(3)}, FinalSim: ${finalSimilarity.toFixed(3)}`);

      if (finalSimilarity >= SIMILARITY_THRESHOLD) {
        if (!bestMatch || finalSimilarity > bestMatch.similarity) {
          bestMatch = { userColumn, similarity: finalSimilarity };
        }
      }
    });

    if (bestMatch) {
      suggestions.push({
        systemFieldKey: systemField.key,
        userColumn: bestMatch.userColumn,
        similarity: bestMatch.similarity,
      });
      usedUserColumns.add(bestMatch.userColumn);
    } else {
      suggestions.push({
        systemFieldKey: systemField.key,
        userColumn: null, // No suggestion found
      });
    }
  });

  return suggestions;
}
