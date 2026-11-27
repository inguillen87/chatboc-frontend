import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, ApiError, getErrorMessage } from '@/utils/api';
import {
  getEmployeeCoverageV2,
  getEmployeeRoutingV2,
  type CoverageBucket,
  type EmployeeCoverageV2,
  type EmployeeRoutingV2,
} from '@/api/v2/saas';
import EmployeeRoutingMatrix from '@/components/admin/EmployeeRoutingMatrix';
import useRequireRole from '@/hooks/useRequireRole';
import { useUser } from '@/hooks/useUser';
import { hasRequiredRole, type Role } from '@/utils/roles';
import { usePrivateAnalyticsScope } from '@/features/analytics/usePrivateAnalyticsScope';
import { ViewState } from '@/components/app-shell/ViewState';
import { privateBackendRead } from '@/utils/privateBackendRead';
import { panelReadOptions } from '@/utils/panelReadOptions';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  PencilLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  UserPlus,
} from 'lucide-react';

const EMPLOYEES_API_BASE = '/api/admin/employees';

type CategoryId = string;
type AnyRecord = Record<string, unknown>;

type Category = {
  id: CategoryId;
  slug: string;
  nombre: string;
  tipo?: string;
};

type EmployeeScope = {
  categorias: string[];
  zonas: string[];
  channels: string[];
  permisos: string[];
};

interface InternalUser {
  id: string | number;
  nombre: string;
  email: string;
  rol?: string | null;
  categorias?: Category[] | null;
  roles?: string[];
  scope?: EmployeeScope | null;
  raw?: unknown;
}

interface EmployeesResponse {
  employees?: unknown[];
  ticket_categories?: unknown[];
  categorias?: unknown[];
  categories?: unknown[];
  items?: unknown[];
}

const DEFAULT_ROLE_OPTIONS = ['empleado', 'operador', 'supervisor', 'analista', 'manager'];

const PERMISSION_GROUPS = [
  {
    id: 'tickets',
    label: 'Casos y atención',
    icon: ClipboardList,
    items: [
      { value: 'tickets_read', label: 'Ver casos' },
      { value: 'tickets_update', label: 'Responder casos y cambiar su estado' },
      { value: 'tickets_assign', label: 'Asignar responsables' },
      { value: 'live_chat', label: 'Atender chat en vivo' },
    ],
  },
  {
    id: 'analytics',
    label: 'Reportes y encuestas',
    icon: BarChart3,
    items: [
      { value: 'analytics.read', label: 'Ver reportes generales' },
      { value: 'surveys_read', label: 'Ver encuestas' },
      { value: 'surveys_write', label: 'Crear y publicar encuestas' },
      { value: 'survey.pii.read', label: 'Ver respuestas con datos sensibles' },
      { value: 'survey.export', label: 'Exportar respuestas (requiere datos sensibles)' },
    ],
  },
  {
    id: 'commerce',
    label: 'Catalogo y pedidos',
    icon: Store,
    items: [
      { value: 'orders_read', label: 'Ver pedidos' },
      { value: 'orders_update', label: 'Gestionar pedidos' },
      { value: 'catalog_read', label: 'Ver catálogo' },
      { value: 'catalog_write', label: 'Editar catálogo e inventario' },
    ],
  },
  {
    id: 'education',
    label: 'Familias y estudiantes',
    icon: ShieldCheck,
    items: [
      { value: 'education.guardians.read', label: 'Consultar perfiles familiares' },
      { value: 'education.guardians.verify', label: 'Confirmar identidad de tutores' },
      { value: 'education.guardians.link', label: 'Vincular tutores y estudiantes' },
    ],
  },
  {
    id: 'admin',
    label: 'Equipo y configuracion',
    icon: Settings,
    items: [
      { value: 'employees_read', label: 'Ver personas del equipo' },
      { value: 'employees_write', label: 'Sumar y editar personas del equipo' },
      { value: 'settings_read', label: 'Ver configuración' },
    ],
  },
];

const ROLE_TEMPLATES = [
  {
    id: 'frontdesk',
    label: 'Mesa de entrada',
    description: 'Lee, responde y carga casos nuevos.',
    roles: ['empleado'],
    permisos: ['tickets_read', 'tickets_update', 'live_chat'],
    channels: ['whatsapp', 'web_demo_widget'],
  },
  {
    id: 'supervisor',
    label: 'Supervisión del equipo',
    description: 'Asigna responsables y consulta reportes.',
    roles: ['supervisor'],
    permisos: ['tickets_read', 'tickets_update', 'tickets_assign', 'analytics.read'],
    channels: ['whatsapp', 'web_demo_widget'],
  },
  {
    id: 'commerce',
    label: 'Catalogo y pedidos',
    description: 'Gestiona pedidos, stock y catálogo.',
    roles: ['operador'],
    permisos: ['orders_read', 'orders_update', 'catalog_read', 'catalog_write'],
    channels: ['web_demo_widget', 'whatsapp'],
  },
  {
    id: 'surveys',
    label: 'Encuestas y reportes',
    description: 'Creá encuestas y consultá resultados.',
    roles: ['analista'],
    permisos: ['surveys_read', 'surveys_write', 'analytics.read'],
    channels: ['whatsapp', 'web_demo_widget'],
  },
  {
    id: 'survey-auditor',
    label: 'Auditor de encuestas',
    description: 'Accede y exporta respuestas sensibles. Asignar solo cuando sea necesario.',
    roles: ['analista'],
    permisos: ['surveys_read', 'analytics.read', 'survey.pii.read', 'survey.export'],
    channels: ['web_demo_widget'],
  },
];

const COMMON_SINGLE_WORD_CATEGORIES = new Set([
  'alumbrado',
  'arbolado',
  'bacheo',
  'cloacas',
  'incendio',
  'limpieza',
  'luminaria',
  'luminarias',
  'otros',
  'sugerencia',
  'general',
]);

const normalizeLabelKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const isSuspiciousCategoryLabel = (value: unknown) => {
  const key = normalizeLabelKey(value);
  if (!key) return true;
  if (key.length > 80 || key.includes('@') || key.includes('http://') || key.includes('https://')) return true;
  if (/^(hola|quiero|quisiera|necesito|codigo|17049)\b/.test(key)) return true;
  if (/\d/.test(key) && key.split(/\s+/).length > 3) return true;
  return (
    key.split(/\s+/).length === 1 &&
    !COMMON_SINGLE_WORD_CATEGORIES.has(key) &&
    /(ito|ita|cito|cita)$/.test(key)
  );
};

const isNoisyZoneLabel = (value: unknown) => {
  const text = String(value ?? '').trim();
  const key = normalizeLabelKey(text);
  if (!key || key.length > 48) return true;
  if (key.length <= 2 || ['arg', 'mza', 'postal'].includes(key)) return true;
  if (key.includes('@') || key.includes('http://') || key.includes('https://')) return true;
  if (/\d/.test(key) && key.split(/\s+/).length === 1) return true;
  if (/\d/.test(key) && (key.includes(',') || /\b(av|calle|ruta|don|plaza)\b/.test(key))) return true;
  return false;
};

const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim());

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const first = (record: AnyRecord | undefined | null, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const normalizeStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeStringList(item))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
  if (isRecord(value)) {
    const candidate = asString(first(value, ['value', 'key', 'id', 'slug', 'label', 'name', 'nombre']));
    return candidate ? [candidate] : [];
  }
  return [];
};

const unique = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const normalizeScope = (value: unknown): EmployeeScope => {
  const record = isRecord(value) ? value : {};
  return {
    categorias: unique(normalizeStringList(first(record, ['categorias', 'categories']))),
    zonas: unique(normalizeStringList(first(record, ['zonas', 'zones']))),
    channels: unique(normalizeStringList(first(record, ['channels', 'canales']))),
    permisos: unique(normalizeStringList(first(record, ['permisos', 'permissions']))),
  };
};

const normalizeCategory = (value: unknown, index = 0): Category | null => {
  if (typeof value === 'string' && value.trim()) {
    const slug = value.trim();
    return { id: slug, slug, nombre: slug };
  }
  if (!isRecord(value)) return null;
  const slug =
    asString(first(value, ['value', 'slug', 'key', 'id', 'codigo', 'code'])) ??
    asString(first(value, ['nombre', 'label', 'name', 'title']));
  const nombre =
    asString(first(value, ['label', 'nombre', 'name', 'title'])) ??
    slug ??
    `categoria_${index + 1}`;
  const id = asString(first(value, ['id', 'value', 'slug', 'key'])) ?? slug ?? nombre;
  return {
    id,
    slug: slug ?? id,
    nombre,
    tipo: asString(value.tipo),
  };
};

const normalizeCategoryList = (value: unknown): Category[] => {
  if (!value) return [];
  const source = Array.isArray(value)
    ? value
    : isRecord(value)
      ? first(value, ['categorias', 'categories', 'ticket_categories', 'items'])
      : [];
  return (Array.isArray(source) ? source : [])
    .map(normalizeCategory)
    .filter((item): item is Category => Boolean(item) && !isSuspiciousCategoryLabel(item.nombre));
};

const coverageBucketToCategory = (bucket: CoverageBucket): Category => ({
  id: bucket.id || bucket.label,
  slug: bucket.id || bucket.label,
  nombre: bucket.label || bucket.id,
});

const mergeCategories = (...groups: Category[][]): Category[] => {
  const map = new Map<string, Category>();
  groups.flat().forEach((category) => {
    if (isSuspiciousCategoryLabel(category.nombre)) return;
    const key = (category.slug || category.id || category.nombre).toLowerCase();
    if (!map.has(key)) map.set(key, category);
  });
  return Array.from(map.values());
};

const normalizeInternalUser = (value: unknown, index = 0): InternalUser | null => {
  if (!isRecord(value)) return null;
  const accesibilidad = isRecord(value.accesibilidad) ? value.accesibilidad : {};
  const rawScope = first(value, ['scope', 'employee_scope']) ?? first(accesibilidad, ['employee_scope', 'scope']);
  const id = first(value, ['id', 'user_id', 'employee_id']) as string | number | undefined;
  const nombre = asString(first(value, ['nombre', 'name', 'display_name'])) ?? asString(value.email) ?? `Persona sin nombre ${index + 1}`;
  return {
    id: id ?? nombre,
    nombre,
    email: asString(value.email) ?? '',
    rol: asString(first(value, ['rol', 'role'])),
    roles: unique(normalizeStringList(value.roles)),
    categorias: normalizeCategoryList(first(value, ['categorias', 'categories', 'ticket_categories'])),
    scope: normalizeScope(rawScope),
    raw: value,
  };
};

const extractEmployees = (response: unknown): InternalUser[] => {
  const source = Array.isArray(response)
    ? response
    : isRecord(response)
      ? first(response, ['employees', 'items', 'users', 'data'])
      : [];
  return (Array.isArray(source) ? source : [])
    .map(normalizeInternalUser)
    .filter((item): item is InternalUser => Boolean(item));
};

const getBackendErrorText = (error: unknown): string | null => {
  if (error instanceof ApiError) {
    const body = error.body;
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (body && typeof body === 'object') {
      const messageCandidates = [
        (body as AnyRecord).message,
        (body as AnyRecord).error,
        (body as AnyRecord).detail,
      ];
      for (const candidate of messageCandidates) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
    }
  }
  return null;
};

const selectedCategorySlugs = (ids: CategoryId[], categories: Category[]) =>
  ids
    .map((id) => categories.find((cat) => cat.id === id || cat.slug === id))
    .filter((cat): cat is Category => Boolean(cat))
    .map((cat) => cat.slug || cat.nombre)
    .filter(Boolean);

const bucketsToValues = (items: CoverageBucket[]) => unique(items.map((item) => item.id || item.label));

const mergeOptionValues = (...groups: string[][]) =>
  unique(groups.flat()).map((value) => ({ value, label: value }));

const dimensionValues = (routing: EmployeeRoutingV2 | null, keys: string[]) => {
  const dimensions = routing?.dimensions ?? {};
  return unique(keys.flatMap((key) => normalizeStringList(dimensions[key])));
};

const employeeScopeValues = (employees: InternalUser[], key: keyof EmployeeScope) =>
  unique(employees.flatMap((employee) => employee.scope?.[key] ?? []));

const isUncovered = (bucket: CoverageBucket, noEmployees: boolean) => {
  const status = (bucket.status || '').toLowerCase();
  return noEmployees || bucket.count === 0 || status.includes('uncovered') || status.includes('missing') || status.includes('sin');
};

const toggleValue = (
  value: string,
  current: string[],
  setList: React.Dispatch<React.SetStateAction<string[]>>,
  options: { keepOne?: boolean } = {},
) => {
  if (current.includes(value)) {
    if (options.keepOne && current.length <= 1) return;
    setList(current.filter((item) => item !== value));
  } else {
    setList([...current, value]);
  }
};

const CoverageColumn = ({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: CoverageBucket[];
  emptyMessage: string;
}) => (
  <div className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs">
        {items.length}
      </Badge>
    </div>
    <div className="space-y-2">
      {items.slice(0, 7).map((item, index) => (
        <div key={`${title}-${item.id || index}`} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
          <span className="truncate pr-3">{item.label || `Dato sin nombre ${index + 1}`}</span>
          <Badge variant={item.count ? 'secondary' : 'outline'}>{item.count ? `${item.count}` : 'sin responsable'}</Badge>
        </div>
      ))}
      {!items.length ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          <a
            href="#sumar-persona"
            className="inline-flex min-h-11 items-center rounded-md font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Configurar en una persona
          </a>
        </div>
      ) : null}
    </div>
  </div>
);

const OptionGroup = ({
  label,
  options,
  selected,
  onToggle,
  empty,
  keepOne,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  empty: string;
  keepOne?: boolean;
}) => (
  <div className="space-y-2">
    <p className="text-sm font-medium">{label}</p>
    <div role="group" aria-label={label} className="flex min-h-11 flex-wrap gap-2 rounded-xl border border-border/70 bg-background p-2">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (active && keepOne && selected.length <= 1) return;
              onToggle(option.value);
            }}
            className={`min-h-11 rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-muted/30 text-foreground hover:border-primary/50'
            }`}
          >
            {option.label}
          </button>
        );
      })}
      {!options.length ? <p className="px-1 py-1 text-xs text-muted-foreground">{empty}</p> : null}
    </div>
  </div>
);

const SearchableOptionGroup = ({
  label,
  options,
  selected,
  onToggle,
  empty,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  empty: string;
}) => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(term));
  }, [options, query]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <span className="text-xs text-muted-foreground">{selected.length} seleccionadas</span>
      </div>
      <div className="rounded-lg border border-border/70 bg-background">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            aria-label={`Buscar en ${label.toLowerCase()}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar categoría"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-48 overflow-y-auto p-2">
          {filtered.map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(option.value)}
                className={`mb-1 flex min-h-11 w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent bg-muted/20 text-foreground hover:border-border'
                }`}
              >
                <span className="truncate pr-3">{option.label}</span>
                {active ? <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
          {!filtered.length ? <p className="px-2 py-3 text-sm text-muted-foreground">{empty}</p> : null}
        </div>
      </div>
    </div>
  );
};

const PermissionGroupSelector = ({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium">Secciones y permisos</p>
      <span className="text-xs text-muted-foreground">{selected.length} permisos activos</span>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      {PERMISSION_GROUPS.map((group) => {
        const Icon = group.icon;
        return (
          <div key={group.id} className="rounded-lg border border-border/70 bg-background p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Icon aria-hidden="true" className="h-4 w-4 text-primary" />
              {group.label}
            </div>
            <div className="space-y-2">
              {group.items.map((item) => {
                const active = selected.includes(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onToggle(item.value)}
                    className={`flex min-h-11 w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted/20 hover:border-primary/50'
                    }`}
                  >
                    <span>{item.label}</span>
                    {active ? <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const ScopeBadges = ({ employee }: { employee: InternalUser }) => {
  const scope = employee.scope ?? normalizeScope(null);
  const entries = [
    ...scope.categorias.map((item) => ({ key: `cat-${item}`, label: `Tema: ${item}`, variant: 'secondary' as const })),
    ...scope.zonas.map((item) => ({ key: `zona-${item}`, label: `Zona: ${item}`, variant: 'outline' as const })),
    ...scope.channels.map((item) => ({ key: `channel-${item}`, label: `Canal: ${item.replace(/_/g, ' ')}`, variant: 'outline' as const })),
  ];
  if (!entries.length) return <span className="text-sm text-muted-foreground">Todavía no se definió qué puede atender.</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map((item) => (
        <Badge key={`${employee.id}-${item.key}`} variant={item.variant}>
          {item.label}
        </Badge>
      ))}
    </div>
  );
};

export default function InternalUsers() {
  useRequireRole(['admin', 'super_admin', 'tenant_admin'] as Role[]);
  const { user } = useUser();
  const { scope, pending, key } = usePrivateAnalyticsScope();
  if (pending) return <ViewState status="loading" title="Validando acceso al equipo" />;
  if (!hasRequiredRole(user?.rol, ['admin', 'super_admin', 'tenant_admin'])) return <ViewState status="denied" title="No tenés acceso a la administración del equipo" />;
  if (!scope) return <ViewState status="denied" title="Organización del equipo no verificada" />;
  return <ScopedInternalUsers key={key} tenantSlug={scope.tenantSlug} />;
}

function ScopedInternalUsers({ tenantSlug }: { tenantSlug: string }) {
  const [employees, setEmployees] = useState<InternalUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<EmployeeCoverageV2 | null>(null);
  const [routing, setRouting] = useState<EmployeeRoutingV2 | null>(null);
  const [lastCreatedEmployee, setLastCreatedEmployee] = useState<InternalUser | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<string[]>(['empleado']);
  const [categoriaIds, setCategoriaIds] = useState<CategoryId[]>([]);
  const [selectedZonas, setSelectedZonas] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedPermisos, setSelectedPermisos] = useState<string[]>([]);

  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>(['empleado']);
  const [editCategoriaIds, setEditCategoriaIds] = useState<CategoryId[]>([]);
  const [editZonas, setEditZonas] = useState<string[]>([]);
  const [editChannels, setEditChannels] = useState<string[]>([]);
  const [editPermisos, setEditPermisos] = useState<string[]>([]);

  const mounted = useRef(true), loadVersion = useRef(0);
  const sessionRevision = useRef(captureChatbocSessionRevision());
  const scopeIsCurrent = useCallback(() => mounted.current && isChatbocSessionRevisionCurrent(sessionRevision.current), []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loadVersion.current++; }; }, []);

  const fetchData = useCallback(async () => {
    if (!scopeIsCurrent()) return;
    const version = ++loadVersion.current;
    const isCurrent = () => scopeIsCurrent() && version === loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const employeesData = await privateBackendRead(EMPLOYEES_API_BASE, tenantSlug, { isCurrent });
      if (!isCurrent()) return;
      const list = extractEmployees(employeesData);

      let cats = normalizeCategoryList(employeesData);
      if (cats.length === 0) {
        const categoriesData = await privateBackendRead(`/api/admin/tenants/${encodeURIComponent(tenantSlug)}/ticket-categories`, tenantSlug, { isCurrent }).catch(() => null);
        if (!isCurrent()) return;
        cats = normalizeCategoryList(categoriesData);
      }

      const [coverageData, routingData] = await Promise.all([
        getEmployeeCoverageV2(tenantSlug, { isCurrent }).catch(() => null),
        getEmployeeRoutingV2(tenantSlug, { isCurrent }).catch(() => null),
      ]);
      if (!isCurrent()) return;

      if (coverageData) {
        cats = mergeCategories(cats, coverageData.categories.map(coverageBucketToCategory));
      }

      setEmployees(list);
      setCategories(cats);
      setCoverage(coverageData);
      setRouting(routingData);
    } catch (err: unknown) {
      if (!isCurrent()) return;
      setError(getErrorMessage(err, 'No pudimos cargar el equipo ni los temas de atención. Recargá la página e intentá de nuevo.'));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [tenantSlug, scopeIsCurrent]);

  useEffect(() => {
    if (tenantSlug) {
      void fetchData();
    } else {
      setLoading(false);
      setError('No se pudo identificar la organización.');
    }
  }, [tenantSlug, fetchData]);

  const roleOptions = useMemo(() => {
    const backendRoles = unique(employees.flatMap((employee) => [...(employee.roles ?? []), employee.rol ?? '']));
    return mergeOptionValues(DEFAULT_ROLE_OPTIONS, backendRoles);
  }, [employees]);

  const zoneOptions = useMemo(() => {
    const values = unique([
      ...dimensionValues(routing, ['zonas', 'zones']),
      ...bucketsToValues(coverage?.zones ?? []),
      ...employeeScopeValues(employees, 'zonas'),
    ]).filter((value) => !isNoisyZoneLabel(value));
    return values.map((value) => ({ value, label: value }));
  }, [coverage?.zones, employees, routing]);

  const channelOptions = useMemo(() => {
    const values = unique([
      ...dimensionValues(routing, ['channels', 'canales', 'channel', 'canal']),
      ...bucketsToValues(coverage?.channels ?? []),
      ...employeeScopeValues(employees, 'channels'),
    ]);
    return values.map((value) => ({ value, label: value }));
  }, [coverage?.channels, employees, routing]);

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((cat) => !isSuspiciousCategoryLabel(cat.nombre))
        .slice()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((cat) => ({ value: cat.id, label: cat.nombre })),
    [categories],
  );

  const coverageCategories = coverage?.categories || [];
  const coverageZones = coverage?.zones || [];
  const coverageChannels = coverage?.channels || [];
  const uncoveredCategories = coverageCategories.filter((item) => isUncovered(item, employees.length === 0));
  const routingEmployeesById = useMemo(() => {
    const map = new Map<string, number | undefined>();
    (routing?.employees ?? []).forEach((employee) => {
      map.set(String(employee.id), employee.workload_open);
      const email = asString(employee.raw.email);
      if (email) map.set(email.toLowerCase(), employee.workload_open);
    });
    return map;
  }, [routing?.employees]);
  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) => {
      const scope = employee.scope ?? normalizeScope(null);
      return [
        employee.nombre,
        employee.email,
        employee.rol ?? '',
        ...(employee.roles ?? []),
        ...scope.categorias,
        ...scope.zonas,
        ...scope.channels,
        ...scope.permisos,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [employeeSearch, employees]);
  const unassignedCount = routing?.queues.unassigned_count ?? null;

  const resetCreateForm = () => {
    setNombre('');
    setEmail('');
    setPassword('');
    setRoles(['empleado']);
    setCategoriaIds([]);
    setSelectedZonas([]);
    setSelectedChannels([]);
    setSelectedPermisos([]);
  };

  const applyCreateTemplate = (template: (typeof ROLE_TEMPLATES)[number]) => {
    setRoles(template.roles);
    setSelectedPermisos(unique([...selectedPermisos, ...template.permisos]));
    const availableChannels = new Set(channelOptions.map((item) => item.value));
    const templateChannels = template.channels.filter((item) => !availableChannels.size || availableChannels.has(item));
    if (templateChannels.length) setSelectedChannels(unique([...selectedChannels, ...templateChannels]));
  };

  const applyEditTemplate = (template: (typeof ROLE_TEMPLATES)[number]) => {
    setEditRoles(template.roles);
    setEditPermisos(unique([...editPermisos, ...template.permisos]));
    const availableChannels = new Set(channelOptions.map((item) => item.value));
    const templateChannels = template.channels.filter((item) => !availableChannels.size || availableChannels.has(item));
    if (templateChannels.length) setEditChannels(unique([...editChannels, ...templateChannels]));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scopeIsCurrent()) return;
    if (!nombre.trim() || !email.trim() || !password.trim()) return;
    if (!isValidEmail(email)) {
      toast.error('Email inválido.');
      return;
    }
    if (!tenantSlug) return;

    try {
      const selectedCategories = selectedCategorySlugs(categoriaIds, categories);
      const selectedRoles = roles.map((role) => role.trim()).filter(Boolean);
      const scope = {
        categorias: selectedCategories,
        zonas: selectedZonas,
        channels: selectedChannels,
        permisos: selectedPermisos,
      };

      const payload = {
        name: nombre.trim(),
        email: email.trim(),
        password,
        roles: selectedRoles,
        categorias: selectedCategories,
        scope,
      };

      const createdResponse = await apiFetch<unknown>(EMPLOYEES_API_BASE, {
        ...panelReadOptions(tenantSlug), singleAttempt: true, allowStartupRecovery: false, isCurrent: scopeIsCurrent,
        method: 'POST',
        tenantSlug,
        body: payload,
      });
      if (!scopeIsCurrent()) return;

      const createdEmployee =
        normalizeInternalUser(
          isRecord(createdResponse)
            ? first(createdResponse, ['employee', 'created_employee', 'item', 'data']) ?? createdResponse
            : createdResponse,
        ) ?? null;

      setLastCreatedEmployee(createdEmployee);
      toast.success('La persona se agregó al equipo.');
      await fetchData();
      resetCreateForm();
    } catch (err: unknown) {
      if (!scopeIsCurrent()) return;
      const backendMessage = getBackendErrorText(err);
      toast.error(backendMessage || getErrorMessage(err, 'No pudimos sumar a la persona. Revisá los datos e intentá otra vez.'));
    }
  };

  const startEdit = (employee: InternalUser) => {
    const scope = employee.scope ?? normalizeScope(null);
    const employeeCategoryIds = mergeCategories(employee.categorias ?? [], scope.categorias.map((item) => ({ id: item, slug: item, nombre: item })))
      .map((category) => categories.find((item) => item.slug === category.slug || item.nombre === category.nombre)?.id ?? category.id);
    setEditingUser(employee);
    setEditNombre(employee.nombre);
    setEditPassword('');
    setEditRoles(employee.roles?.length ? employee.roles : employee.rol ? [employee.rol] : ['empleado']);
    setEditCategoriaIds(unique(employeeCategoryIds));
    setEditZonas(scope.zonas);
    setEditChannels(scope.channels);
    setEditPermisos(scope.permisos);
  };

  const cancelEdit = () => {
    setEditingUser(null);
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser || !scopeIsCurrent()) return;

    try {
      const selectedCategories = selectedCategorySlugs(editCategoriaIds, categories);
      const selectedRoles = editRoles.map((role) => role.trim()).filter(Boolean);
      const scope = {
        categorias: selectedCategories,
        zonas: editZonas,
        channels: editChannels,
        permisos: editPermisos,
      };

      const payload: {
        name: string;
        roles: string[];
        categorias: string[];
        scope: EmployeeScope;
        password?: string;
      } = {
        name: editNombre.trim(),
        roles: selectedRoles,
        categorias: selectedCategories,
        scope,
      };
      if (editPassword) payload.password = editPassword;

      await apiFetch(`${EMPLOYEES_API_BASE}/${editingUser.id}`, {
        ...panelReadOptions(tenantSlug), singleAttempt: true, allowStartupRecovery: false, isCurrent: scopeIsCurrent,
        method: 'PUT',
        tenantSlug,
        body: payload,
      });
      if (!scopeIsCurrent()) return;

      toast.success('Los datos de la persona se actualizaron.');
      setEditingUser(null);
      await fetchData();
    } catch (err: unknown) {
      if (!scopeIsCurrent()) return;
      const backendMessage = getBackendErrorText(err);
      toast.error(backendMessage || getErrorMessage(err, 'No pudimos actualizar a la persona. Intentá otra vez.'));
    }
  };

  if (loading) return <div role="status" className="p-4 text-muted-foreground">Cargando el equipo…</div>;
  if (error) {
    return (
      <div role="alert" className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void fetchData()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-8">
      <section className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Equipo y permisos</h1>
            <p className="mt-2 text-base leading-7 text-muted-foreground">
              Acá podés sumar personas, elegir qué casos atiende cada una y definir qué secciones puede usar.
            </p>
          </div>
          <Button asChild className="min-h-11 shrink-0">
            <a href="#sumar-persona">Sumar una persona</a>
          </Button>
        </div>
      </section>

      {employees.length === 0 ? (
        <section aria-labelledby="equipo-vacio" className="rounded-lg border border-border bg-card p-6">
          <h2 id="equipo-vacio" className="text-xl font-semibold text-foreground">Todavía no hay personas en el equipo</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Sumá a la primera persona para asignarle casos, zonas, canales y permisos de acceso.
          </p>
          <Button asChild className="mt-4 min-h-11">
            <a href="#sumar-persona">Sumar a la primera persona del equipo</a>
          </Button>
        </section>
      ) : (
        <section aria-labelledby="resumen-equipo" className="rounded-lg border border-border/70 bg-card p-5">
          <h2 id="resumen-equipo" className="text-lg font-semibold text-foreground">Estado del equipo</h2>
          <dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Personas</dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">{employees.length.toLocaleString('es-AR')}</dd>
              <p className="mt-1 text-sm text-muted-foreground">Con acceso al panel.</p>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Temas de atención</dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">{categories.length ? categories.length.toLocaleString('es-AR') : 'Todavía no hay'}</dd>
              <p className="mt-1 text-sm text-muted-foreground">Disponibles para asignar.</p>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Temas sin responsable</dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">{coverage ? uncoveredCategories.length ? uncoveredCategories.length.toLocaleString('es-AR') : 'Todos tienen responsable' : 'No se pudo comprobar'}</dd>
              <p className="mt-1 text-sm text-muted-foreground">Revisá quién atiende cada tema.</p>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Casos sin responsable</dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">{unassignedCount === null ? 'No se pudo comprobar' : unassignedCount ? unassignedCount.toLocaleString('es-AR') : 'Todos tienen responsable'}</dd>
              <p className="mt-1 text-sm text-muted-foreground">Casos abiertos que esperan asignación.</p>
            </div>
          </dl>
        </section>
      )}

      {lastCreatedEmployee ? (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Persona agregada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium">{lastCreatedEmployee.nombre}</p>
              <p className="text-sm text-muted-foreground">{lastCreatedEmployee.email}</p>
            </div>
            <ScopeBadges employee={lastCreatedEmployee} />
          </CardContent>
        </Card>
      ) : null}

      <Accordion id="sumar-persona" type="single" collapsible className="w-full scroll-mt-6" defaultValue="new-employee">
        <AccordionItem value="new-employee">
          <AccordionTrigger className="min-h-11 rounded-2xl px-4 py-3 text-left hover:no-underline">
            <span className="flex items-center gap-2">
              <UserPlus aria-hidden="true" className="h-4 w-4 text-primary" />
              Sumar una persona al equipo
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <form onSubmit={handleCreate} className="space-y-5 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <section className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">1. Acceso</p>
                  <p className="text-xs text-muted-foreground">La persona entra con este email y cambia la contraseña después.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label htmlFor="new-team-name" className="text-sm font-medium">Nombre visible</label>
                    <Input id="new-team-name" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Nombre y apellido" required />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="new-team-email" className="text-sm font-medium">Email de acceso</label>
                    <Input id="new-team-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email institucional" autoComplete="email" required />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="new-team-password" className="text-sm font-medium">Contraseña temporal</label>
                    <Input id="new-team-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">2. Tareas y permisos</p>
                  <p className="text-xs text-muted-foreground">Elegí el perfil más parecido a su tarea y después ajustá lo necesario.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {ROLE_TEMPLATES.map((template) => {
                    const active = template.roles.some((role) => roles.includes(role));
                    return (
                      <button
                        key={template.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => applyCreateTemplate(template)}
                        className={`min-h-11 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background hover:border-primary/50'
                        }`}
                      >
                        <span className="block text-sm font-semibold">{template.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{template.description}</span>
                      </button>
                    );
                  })}
                </div>
                <OptionGroup
                  label="Rol de la persona"
                  options={roleOptions}
                  selected={roles}
                  keepOne
                  onToggle={(value) => toggleValue(value, roles, setRoles, { keepOne: true })}
                  empty="No hay otros roles disponibles."
                />
              </section>

              <section className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">3. Qué va a atender</p>
                  <p className="text-xs text-muted-foreground">Seleccioná los temas, canales y zonas que van a quedar a su cargo.</p>
                </div>
                <SearchableOptionGroup
                  label="Qué casos atiende"
                  options={categoryOptions}
                  selected={categoriaIds}
                  onToggle={(value) => toggleValue(value, categoriaIds, setCategoriaIds)}
                  empty="Todavía no hay temas de atención disponibles."
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <OptionGroup
                    label="Canales"
                    options={channelOptions}
                    selected={selectedChannels}
                    onToggle={(value) => toggleValue(value, selectedChannels, setSelectedChannels)}
                    empty="Todavía no hay canales disponibles."
                  />
                  <OptionGroup
                    label="Zonas"
                    options={zoneOptions}
                    selected={selectedZonas}
                    onToggle={(value) => toggleValue(value, selectedZonas, setSelectedZonas)}
                    empty="Todavía no hay zonas disponibles."
                  />
                </div>
              </section>

              <Accordion type="single" collapsible>
                <AccordionItem value="permissions">
                  <AccordionTrigger className="min-h-11 rounded-xl border border-border/60 bg-background px-4 py-3 text-sm hover:no-underline">
                    Revisar permisos específicos
                    <Badge variant="outline" className="ml-2 rounded-full">{selectedPermisos.length} activos</Badge>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <PermissionGroupSelector
                      selected={selectedPermisos}
                      onToggle={(value) => toggleValue(value, selectedPermisos, setSelectedPermisos)}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button type="submit" className="min-h-11 w-full gap-2 rounded-xl sm:w-auto">
                <UserPlus aria-hidden="true" className="h-4 w-4" />
                Sumar al equipo
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {editingUser ? (
        <div className="rounded-2xl border border-border/60 bg-card p-4 text-card-foreground shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <PencilLine aria-hidden="true" className="h-4 w-4 text-primary" />
              Editar a {editingUser.nombre}
            </h3>
            <Button variant="ghost" onClick={cancelEdit} className="min-h-11 w-full sm:w-auto">Cancelar</Button>
          </div>
          <form onSubmit={handleUpdate} className="space-y-5">
            <section className="space-y-3">
              <div>
                  <p className="text-sm font-semibold text-foreground">1. Acceso</p>
                <p className="text-xs text-muted-foreground">Actualizá el nombre visible o cambiá la contraseña temporal.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="edit-team-name" className="text-sm font-medium">Nombre visible</label>
                  <Input id="edit-team-name" value={editNombre} onChange={(event) => setEditNombre(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label htmlFor="edit-team-password" className="text-sm font-medium">Nueva contraseña</label>
                  <Input id="edit-team-password" type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder="Dejá este campo vacío para conservarla" autoComplete="new-password" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">2. Tareas y permisos</p>
                <p className="text-xs text-muted-foreground">Usá un perfil como punto de partida y ajustá sólo lo necesario.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {ROLE_TEMPLATES.map((template) => {
                  const active = template.roles.some((role) => editRoles.includes(role));
                  return (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyEditTemplate(template)}
                      className={`min-h-11 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background hover:border-primary/50'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{template.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{template.description}</span>
                    </button>
                  );
                })}
              </div>
              <OptionGroup label="Rol de la persona" options={roleOptions} selected={editRoles} keepOne onToggle={(value) => toggleValue(value, editRoles, setEditRoles, { keepOne: true })} empty="No hay otros roles disponibles." />
            </section>

            <section className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">3. Qué va a atender</p>
                <p className="text-xs text-muted-foreground">Asigná sólo los casos, canales y zonas que van a quedar a su cargo.</p>
              </div>
              <SearchableOptionGroup
                label="Qué casos atiende"
                options={categoryOptions}
                selected={editCategoriaIds}
                onToggle={(value) => toggleValue(value, editCategoriaIds, setEditCategoriaIds)}
                empty="Todavía no hay temas de atención disponibles."
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <OptionGroup label="Canales" options={channelOptions} selected={editChannels} onToggle={(value) => toggleValue(value, editChannels, setEditChannels)} empty="Todavía no hay canales disponibles." />
                <OptionGroup label="Zonas" options={zoneOptions} selected={editZonas} onToggle={(value) => toggleValue(value, editZonas, setEditZonas)} empty="Todavía no hay zonas disponibles." />
              </div>
            </section>

            <Accordion type="single" collapsible>
              <AccordionItem value="edit-permissions">
                <AccordionTrigger className="min-h-11 rounded-xl border border-border/60 bg-background px-4 py-3 text-sm hover:no-underline">
                  Revisar permisos específicos
                  <Badge variant="outline" className="ml-2 rounded-full">{editPermisos.length} activos</Badge>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <PermissionGroupSelector selected={editPermisos} onToggle={(value) => toggleValue(value, editPermisos, setEditPermisos)} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="min-h-11 w-full gap-2 rounded-xl sm:w-auto">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                Guardar cambios
              </Button>
              <Button type="button" variant="outline" onClick={cancelEdit} className="min-h-11 w-full rounded-xl sm:w-auto">
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <div id="directorio-equipo" className="scroll-mt-6 overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Personas del equipo</h2>
            <p className="mt-1 text-sm text-muted-foreground">Revisá qué puede atender cada persona y cuántos casos tiene abiertos.</p>
          </div>
          <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 lg:w-80">
            <Search aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Buscar una persona del equipo"
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder="Buscar por persona, tema o permiso"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Nombre</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Roles</th>
                <th className="p-3 font-medium">Qué atiende</th>
                <th className="p-3 font-medium">Casos abiertos</th>
                <th className="p-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const workload =
                  routingEmployeesById.get(String(employee.id)) ??
                  routingEmployeesById.get(employee.email.toLowerCase());
                const rolesToShow = unique([...(employee.roles ?? []), employee.rol ?? '']);
                return (
                  <tr key={employee.id} className="border-t transition-colors hover:bg-muted/50">
                    <td className="p-3 font-medium">{employee.nombre}</td>
                    <td className="p-3">{employee.email}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {rolesToShow.map((role) => (
                          <Badge key={`${employee.id}-${role}`} variant="outline" className="capitalize">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <ScopeBadges employee={employee} />
                    </td>
                    <td className="p-3 font-semibold">{workload ?? 'No informado'}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" className="min-h-11 gap-2" onClick={() => startEdit(employee)}>
                        <PencilLine aria-hidden="true" className="h-4 w-4" />
                        Editar responsabilidades
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      {employees.length === 0 ? 'Todavía no hay personas para mostrar.' : 'No encontramos personas con esa búsqueda.'}
                    </p>
                    {employees.length === 0 ? (
                      <Button asChild className="mt-3 min-h-11">
                        <a href="#sumar-persona">Sumar a la primera persona del equipo</a>
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => setEmployeeSearch('')}>
                        Limpiar búsqueda
                      </Button>
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <details id="datos-soporte" className="group overflow-hidden rounded-lg border border-border/60 bg-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Settings aria-hidden="true" className="h-4 w-4 text-primary" />
          Datos para soporte
        </summary>
        <div className="space-y-6 border-t border-border/60 p-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Esta información ayuda a revisar cómo se asignan los temas, las zonas y los canales. No hace falta usarla para sumar o editar personas.
          </p>
          <section aria-labelledby="cobertura-soporte" className="space-y-4">
            <div>
              <h2 id="cobertura-soporte" className="text-base font-semibold text-foreground">Datos de asignación</h2>
              <p className="mt-1 text-sm text-muted-foreground">Muestra cuántas personas pueden atender cada opción informada.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <CoverageColumn title="Temas de atención" items={coverageCategories} emptyMessage="La organización todavía no informó temas para asignar." />
              <CoverageColumn title="Zonas" items={coverageZones} emptyMessage="La organización todavía no informó zonas para asignar." />
              <CoverageColumn title="Canales" items={coverageChannels} emptyMessage="La organización todavía no informó canales para asignar." />
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600" />
                Temas que todavía no tienen responsable
              </h3>
              {uncoveredCategories.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {uncoveredCategories.map((item) => (
                    <Badge key={item.id || item.label} variant="outline" className="rounded-full px-3 py-1">
                      {item.label || item.id}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {coverage ? 'Todos los temas informados tienen al menos una persona responsable.' : 'No pudimos comprobar quién atiende cada tema.'}
                </p>
              )}
            </div>
          </section>
          <section aria-labelledby="asignacion-interna" className="space-y-3">
            <h2 id="asignacion-interna" className="text-base font-semibold text-foreground">Configuración interna de asignaciones</h2>
            <EmployeeRoutingMatrix tenantSlug={tenantSlug} />
          </section>
        </div>
      </details>
    </div>
  );
}
