import type { DemoRubroTool, DemoWorkspaceConfig } from './demoTypes';

type UnknownRecord = Record<string, unknown>;

export interface NormalizedDemoToolField {
  label: string;
  value: string;
}

export interface NormalizedDemoRubroTool {
  id: string;
  kind: string;
  label: string;
  description?: string;
  statusLabel?: string;
  actionLabel?: string;
  actionHref?: string;
  endpoint?: string;
  method?: string;
  fields: NormalizedDemoToolField[];
}

const TOOL_SOURCES = [
  'rubro_tools',
  'business_tools',
  'operational_tools',
  'tools',
] as const;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readString = (source: UnknownRecord | null | undefined, keys: string[]) => {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const readNumber = (source: UnknownRecord | null | undefined, keys: string[]) => {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
};

const normalizeKind = (tool: UnknownRecord) =>
  (readString(tool, ['id', 'key', 'kind', 'type', 'category', 'tool_type']) || 'tool')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');

const normalizeFieldValue = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'si' : 'no';
  return undefined;
};

const normalizeFields = (value: unknown): NormalizedDemoToolField[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const record = asRecord(item);
        if (!record) return null;
        const label = readString(record, ['label', 'title', 'key', 'name']);
        const fieldValue = normalizeFieldValue(record.value ?? record.text ?? record.detail);
        return label && fieldValue ? { label, value: fieldValue } : null;
      })
      .filter((field): field is NormalizedDemoToolField => Boolean(field));
  }

  const record = asRecord(value);
  if (!record) return [];

  return Object.entries(record)
    .map(([key, fieldValue]) => {
      const normalizedValue = normalizeFieldValue(fieldValue);
      return normalizedValue ? { label: key.replace(/_/g, ' '), value: normalizedValue } : null;
    })
    .filter((field): field is NormalizedDemoToolField => Boolean(field));
};

const buildGoogleMapsHref = (tool: UnknownRecord) => {
  const location = asRecord(tool.location);
  const source = location ?? tool;
  const explicitUrl = readString(source, ['maps_url', 'google_maps_url', 'map_url']);
  if (explicitUrl) return explicitUrl;

  const lat = readNumber(source, ['lat', 'latitude', 'latitud']);
  const lng = readNumber(source, ['lng', 'longitude', 'longitud']);
  const address = readString(source, ['address', 'direccion']);
  const query = lat !== undefined && lng !== undefined ? `${lat},${lng}` : address;

  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : undefined;
};

const firstItemRecord = (tool: UnknownRecord) => {
  const items = Array.isArray(tool.items) ? tool.items : [];
  return asRecord(items[0]);
};

const buildActionHref = (tool: UnknownRecord, kind: string) => {
  const explicitUrl = readString(tool, ['url', 'href', 'action_url', 'deeplink', 'wa_deeplink']);
  if (explicitUrl) return explicitUrl;

  const firstItem = firstItemRecord(tool);
  const firstItemUrl = readString(firstItem, ['url', 'href', 'action_url', 'maps_url', 'google_maps_url']);
  if (firstItemUrl) return firstItemUrl;

  if (kind.includes('location') || kind.includes('ubic') || kind.includes('map')) {
    return buildGoogleMapsHref(tool);
  }

  const data = asRecord(tool.data);
  const phone = readString(tool, ['phone', 'telefono', 'tel']) || readString(data, ['phone', 'telefono', 'whatsapp', 'tel']);
  if (phone && (kind.includes('phone') || kind.includes('telefono') || kind.includes('whatsapp'))) {
    return kind.includes('whatsapp')
      ? `https://wa.me/${phone.replace(/\D+/g, '')}`
      : `tel:${phone.replace(/\s+/g, '')}`;
  }

  const email = readString(tool, ['email', 'mail']) || readString(data, ['email', 'mail']);
  if (email && kind.includes('email')) return `mailto:${email}`;

  return undefined;
};

const collectTools = (workspace?: DemoWorkspaceConfig | null) => {
  const workspaceRecord = asRecord(workspace);
  const blueprintRecord = asRecord(workspace?.experience_blueprint);
  const toolkitRecord = asRecord(workspaceRecord?.toolkit);
  const blueprintToolkitRecord = asRecord(blueprintRecord?.toolkit);
  const rubroToolsRecord = asRecord(workspaceRecord?.rubro_tools);
  const blueprintRubroToolsRecord = asRecord(blueprintRecord?.rubro_tools);

  return [
    ...asArray(rubroToolsRecord?.enabled_tools),
    ...asArray(rubroToolsRecord?.tools),
    ...TOOL_SOURCES.flatMap((key) => asArray(workspaceRecord?.[key])),
    ...asArray(toolkitRecord?.tools),
    ...asArray(blueprintRubroToolsRecord?.enabled_tools),
    ...asArray(blueprintRubroToolsRecord?.tools),
    ...TOOL_SOURCES.flatMap((key) => asArray(blueprintRecord?.[key])),
    ...asArray(blueprintToolkitRecord?.tools),
  ];
};

export const normalizeDemoRubroTools = (
  workspace?: DemoWorkspaceConfig | null,
): NormalizedDemoRubroTool[] =>
  collectTools(workspace)
    .map((candidate, index) => {
      const tool = asRecord(candidate);
      if (!tool || tool.enabled === false) return null;

      const label = readString(tool, ['label', 'title', 'name']);
      if (!label) return null;

      const kind = normalizeKind(tool);
      const actionLabel = readString(tool, ['action_label', 'cta_label', 'button_label']);
      const actionHref = buildActionHref(tool, kind);
      const id = readString(tool, ['id', 'key', 'slug']) || `${kind}-${index}`;
      const dataFields = normalizeFields(tool.data);
      const itemFields = normalizeFields(firstItemRecord(tool));
      const fields = normalizeFields(tool.fields);

      return {
        id,
        kind,
        label,
        description: readString(tool, ['description', 'detail', 'subtitle']),
        statusLabel: readString(tool, ['status_label', 'status']),
        actionLabel,
        actionHref,
        endpoint: readString(tool, ['endpoint']),
        method: readString(tool, ['method']),
        fields: fields.length ? fields : dataFields.length ? dataFields : itemFields,
      };
    })
    .filter((tool): tool is NormalizedDemoRubroTool => Boolean(tool));
