export const mergeAndSortStrings = (base: string[], extras: string[]): string[] => {
  const unique = new Set<string>([...base, ...extras.filter(Boolean)]);
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
};
