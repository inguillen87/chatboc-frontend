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

type LegacyPayloadRecord = Record<string, unknown>;

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
    text === "soluciones para sector publico" ||
    (text.startsWith("soluciones para") &&
      (text.includes("empresas") || text.includes("sector publico")))
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

const isRecord = (value: unknown): value is LegacyPayloadRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const readPayloadRows = (value: LegacyPayloadRecord): unknown[] => {
  const candidates = [
    value.rows,
    value.botones,
    value.buttons,
    value.options,
    value.quick_replies,
    value.quickReplies,
    value.menu,
    value.items,
  ];

  return candidates.flatMap((candidate) => (Array.isArray(candidate) ? candidate : []));
};

export const isLegacyDemoSelectorPayload = (
  value: unknown,
  depth = 0,
): boolean => {
  if (depth > 5 || value == null) return false;

  if (typeof value === "string") {
    return isLegacyDemoSelectorText(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => isLegacyDemoSelectorPayload(item, depth + 1));
  }

  if (!isRecord(value)) return false;

  if (
    isLegacyDemoSelectorText(
      value.message_body ??
        value.messageBody ??
        value.message ??
        value.text ??
        value.content ??
        value.respuesta ??
        value.descripcion ??
        value.description,
    )
  ) {
    return true;
  }

  const menuCandidates = [
    value.interactive_sections,
    value.interactiveSections,
    value.sections,
    isRecord(value.interactive_list) ? value.interactive_list.sections : null,
    isRecord(value.interactiveList) ? value.interactiveList.sections : null,
  ];
  if (menuCandidates.some((candidate) => isLegacyDemoSelectorMenu(candidate))) {
    return true;
  }

  const rows = readPayloadRows(value);
  if (
    rows.length > 0 &&
    rows.every((row) => {
      if (typeof row === "string") return isLegacyDemoSelectorOptionTitle(row);
      if (!isRecord(row)) return false;
      return isLegacyDemoSelectorOptionTitle(
        row.title ?? row.label ?? row.text ?? row.nombre ?? row.name,
      );
    })
  ) {
    return true;
  }

  return Object.values(value).some((item) =>
    isLegacyDemoSelectorPayload(item, depth + 1),
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
