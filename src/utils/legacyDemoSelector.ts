type LegacyMenuRow = {
  id?: string;
  title?: string;
  label?: string;
  text?: string;
  description?: string;
};

type LegacyMenuSection = {
  title?: string;
  rows?: LegacyMenuRow[];
};

const normalizeLegacyText = (value: unknown) =>
  typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    : "";

export const isLegacyDemoSelectorText = (value: unknown) => {
  const text = normalizeLegacyText(value);
  if (!text) return false;
  return (
    text.includes("showroom interactivo de chatboc") ||
    text.includes("elegi el rubro que queres explorar") ||
    text.includes("descubri catalogos, pedidos y herramientas inteligentes")
  );
};

export const isLegacyDemoSelectorOptionTitle = (value: unknown) => {
  const text = normalizeLegacyText(value);
  return (
    text === "soluciones para empresas" ||
    text === "soluciones para sector publico"
  );
};

export const isLegacyDemoSelectorMenu = (sections: unknown) => {
  if (!Array.isArray(sections)) return false;
  const rows = sections.flatMap((section) =>
    section && typeof section === "object" && Array.isArray((section as LegacyMenuSection).rows)
      ? ((section as LegacyMenuSection).rows || [])
      : [],
  );
  return (
    rows.length > 0 &&
    rows.every((row) =>
      isLegacyDemoSelectorOptionTitle(row?.title ?? row?.label ?? row?.text),
    )
  );
};

export const filterLegacyDemoSelectorSections = <T extends LegacyMenuSection>(
  sections: T[] | undefined,
): T[] => {
  if (!Array.isArray(sections)) return [];
  return sections
    .map((section) => {
      const rows = Array.isArray(section.rows)
        ? section.rows.filter(
            (row) =>
              !isLegacyDemoSelectorOptionTitle(row?.title ?? row?.label ?? row?.text),
          )
        : [];
      return { ...section, rows } as T;
    })
    .filter((section) => Array.isArray(section.rows) && section.rows.length > 0);
};
