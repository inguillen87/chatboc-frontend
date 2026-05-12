import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import MapLibreMap from '@/components/MapLibreMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TicketInboxPage } from '@/components/tickets/inbox';
import { educationApi } from '@/api/education';
import EducationShell from '@/components/education/EducationShell';
import { useTenant } from '@/context/TenantContext';
import { useEducationAdminMenu } from '@/hooks/useEducationAdminMenu';
import { useEducationShellData } from '@/hooks/useEducationShellData';
import type { HeatPoint } from '@/services/statsService';
import type {
  EducationAdminMenu,
  EducationCasesListEnvelope,
  EducationOperationsAction,
  EducationOperationsHeatmap,
  EducationOperationsSummary,
  EducationPanelSection,
  EducationProfileField,
  EducationQuickMenuItem,
  EducationStaffFilter,
  EducationWhatsappPlaybook,
} from '@/types/education';

const FilterGroup = ({
  title,
  filters,
  searchParams,
  onSelectFilter,
}: {
  title: string;
  filters: EducationStaffFilter[];
  searchParams: URLSearchParams;
  onSelectFilter: (queryKey: string | undefined, queryValue: string | undefined, isActive: boolean) => void;
}) => {
  if (filters.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const isActive = filter.query_key ? searchParams.get(filter.query_key) === filter.query_value : false;
          return (
            <Button
              key={filter.id}
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => onSelectFilter(filter.query_key, filter.query_value, isActive)}
            >
              {filter.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default function EducationStaffInboxPage() {
  const { data } = useEducationShellData('staff');
  const educationAdmin = useEducationAdminMenu();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = data?.staff_filters ?? [];
  const sensitivityFilters = data?.staff_sensitivity_filters ?? [];
  const contextFields = data?.staff_context_fields ?? [];
  const caseTimeline = data?.staff_case_timeline ?? [];
  const presetCategory = searchParams.get('case_type') ?? undefined;
  const presetSensitivity = searchParams.get('sensitivity') ?? undefined;

  const onSelectFilter = (queryKey: string | undefined, queryValue: string | undefined, isActive: boolean) => {
    if (!queryKey) return;
    const next = new URLSearchParams(searchParams);
    if (isActive || !queryValue) {
      next.delete(queryKey);
    } else {
      next.set(queryKey, queryValue);
    }
    setSearchParams(next);
  };

  return (
    <EducationShell persona="staff">
      <div className="grid gap-4 xl:grid-cols-[360px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Contexto alumno/familia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {contextFields.length > 0 ? (
              <div className="space-y-1">
                {contextFields.map((field) => (
                  <p key={field.id}>
                    <span className="font-medium text-foreground">{field.label}:</span> {field.value}
                  </p>
                ))}
              </div>
            ) : (
              <p>Ficha contextual pendiente de datos backend segun permisos del staff.</p>
            )}
            <FilterGroup
              title="Filtros de caso"
              filters={filters}
              searchParams={searchParams}
              onSelectFilter={onSelectFilter}
            />
            <FilterGroup
              title="Sensibilidad"
              filters={sensitivityFilters}
              searchParams={searchParams}
              onSelectFilter={onSelectFilter}
            />
            {caseTimeline.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Timeline contextual</p>
                <div className="space-y-2">
                  {caseTimeline.map((entry) => (
                    <div key={entry.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground">{entry.label}</span>
                        {entry.kind ? <Badge variant="outline">{entry.kind}</Badge> : null}
                      </div>
                      {entry.timestamp ? <p className="text-xs text-muted-foreground">{entry.timestamp}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <EducationAdminContractPanel
              adminMenu={educationAdmin.data.adminMenu}
              whatsappPlaybook={educationAdmin.data.whatsappPlaybook}
              quickMenu={educationAdmin.data.quickMenu}
              panelSections={educationAdmin.data.panelSections}
              profileFields={educationAdmin.data.profileFields}
              operationsSummary={educationAdmin.data.operationsSummary}
              operationsHeatmap={educationAdmin.data.operationsHeatmap}
              isLoading={educationAdmin.isLoading}
              isOperationsLoading={educationAdmin.operationsSummaryQuery.isLoading}
              isHeatmapLoading={educationAdmin.operationsHeatmapQuery.isLoading}
            />
          </CardContent>
        </Card>
        <div className="min-w-0">
          <TicketInboxPage presetCategory={presetCategory} presetSensitivity={presetSensitivity} />
        </div>
      </div>
    </EducationShell>
  );
}

const EducationAdminContractPanel = ({
  adminMenu,
  whatsappPlaybook,
  quickMenu,
  panelSections,
  profileFields,
  operationsSummary,
  operationsHeatmap,
  isLoading,
  isOperationsLoading,
  isHeatmapLoading,
}: {
  adminMenu?: EducationAdminMenu | null;
  whatsappPlaybook?: EducationWhatsappPlaybook | null;
  quickMenu: EducationQuickMenuItem[];
  panelSections: EducationPanelSection[];
  profileFields: EducationProfileField[];
  operationsSummary?: EducationOperationsSummary | null;
  operationsHeatmap?: EducationOperationsHeatmap | null;
  isLoading: boolean;
  isOperationsLoading: boolean;
  isHeatmapLoading: boolean;
}) => {
  if (isLoading && !adminMenu && !whatsappPlaybook) {
    return <p>Sincronizando contrato educativo...</p>;
  }

  if (
    !adminMenu &&
    !whatsappPlaybook &&
    !operationsSummary &&
    !operationsHeatmap &&
    !quickMenu.length &&
    !panelSections.length &&
    !profileFields.length
  ) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border bg-background/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-foreground">Contrato colegio</p>
        {adminMenu?.contract_version ? <Badge variant="outline">{adminMenu.contract_version}</Badge> : null}
        {whatsappPlaybook?.contract_version ? <Badge variant="secondary">{whatsappPlaybook.contract_version}</Badge> : null}
        {operationsSummary?.contract_version ? <Badge variant="outline">{operationsSummary.contract_version}</Badge> : null}
        {operationsHeatmap?.contract_version ? <Badge variant="outline">{operationsHeatmap.contract_version}</Badge> : null}
      </div>

      {operationsSummary ? (
        <EducationOperationsSummaryPanel payload={operationsSummary} />
      ) : isOperationsLoading ? (
        <p className="text-xs text-muted-foreground">Sincronizando resumen operativo...</p>
      ) : null}
      {operationsHeatmap ? (
        <EducationOperationsHeatmapPanel payload={operationsHeatmap} />
      ) : isHeatmapLoading ? (
        <p className="text-xs text-muted-foreground">Sincronizando mapa escolar...</p>
      ) : null}
      {profileFields.length ? <ProfileFieldsList fields={profileFields} /> : null}
      {panelSections.length ? <PanelSectionsList sections={panelSections} /> : null}
      {whatsappPlaybook ? (
        <EducationWhatsappPreview playbook={whatsappPlaybook} fallbackQuickMenu={quickMenu} />
      ) : quickMenu.length ? (
        <EducationQuickMenuPreview items={quickMenu} />
      ) : null}
    </div>
  );
};

const OPERATIONS_SUMMARY_LABELS: Record<string, string> = {
  schools: 'Colegios',
  total_cases: 'Casos totales',
  open_cases: 'Casos abiertos',
  waiting_assignment: 'Sin responsable',
  sensitive_open_cases: 'Sensibles',
  cases_today: 'Hoy',
  cases_with_location: 'Con ubicacion',
  cases_with_attachments: 'Con adjuntos',
};

const humanizeKey = (value: string) => value.replace(/_/g, ' ');

const readMetricValue = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('es-AR')
    : value === null || value === undefined
      ? '-'
      : String(value);

const getSummaryMetrics = (summary: EducationOperationsSummary['summary']) => {
  if (!summary) return [];
  const preferred = Object.keys(OPERATIONS_SUMMARY_LABELS).filter((key) => summary[key] !== undefined);
  const extra = Object.keys(summary).filter((key) => !preferred.includes(key));
  return [...preferred, ...extra].slice(0, 8).map((key) => ({
    key,
    label: OPERATIONS_SUMMARY_LABELS[key] ?? humanizeKey(key),
    value: readMetricValue(summary[key]),
  }));
};

const getBreakdownEntries = (breakdown: EducationOperationsSummary['breakdown']) => {
  if (!breakdown) return [];
  return Object.entries(breakdown).slice(0, 4).map(([key, value]) => ({
    key,
    label: humanizeKey(key),
    items: value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value as Record<string, unknown>).slice(0, 4)
      : [],
  }));
};

const getHeatmapMetrics = (summary: EducationOperationsHeatmap['summary']) => {
  if (!summary) return [];
  return Object.entries(summary).slice(0, 4).map(([key, value]) => ({
    key,
    label: humanizeKey(key),
    value: readMetricValue(value),
  }));
};

const mapEducationHeatmapPoints = (points: EducationOperationsHeatmap['points']): HeatPoint[] =>
  (points ?? [])
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point) => {
      const numericId =
        typeof point.id === 'number'
          ? point.id
          : typeof point.school_case_id === 'number'
            ? point.school_case_id
            : undefined;
      return {
        lat: point.lat,
        lng: point.lng,
        id: numericId,
        ticket: point.ticket?.id !== undefined && point.ticket?.id !== null ? String(point.ticket.id) : undefined,
        weight: typeof point.weight === 'number' && Number.isFinite(point.weight) ? point.weight : 1,
        categoria: point.case_type ?? undefined,
        tipo_ticket: point.ticket?.type ?? undefined,
        estado: point.ticket?.status ?? undefined,
        canal: point.channel ?? undefined,
        severidad: point.sensitivity_level ?? undefined,
        source: 'education_cases',
      };
    });

const getHeatmapBounds = (points: HeatPoint[]): [number, number][] =>
  points
    .map((point) => [point.lng, point.lat] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

const getArrayPreviewItems = (value: unknown[] | undefined, labelKey: string) =>
  (value ?? []).slice(0, 4).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return {
        id: `${labelKey}-${index}`,
        label: `${labelKey} ${index + 1}`,
        detail: readMetricValue(item),
      };
    }
    const record = item as Record<string, unknown>;
    const label =
      record.label ??
      record.id ??
      record.reason_code ??
      record.case_type ??
      record.school_case_id ??
      `${labelKey} ${index + 1}`;
    const detail =
      record.count ??
      record.weight ??
      record.points ??
      record.open_points ??
      record.sensitive_points ??
      record.status ??
      record.channel ??
      null;
    return {
      id: `${labelKey}-${String(label)}-${index}`,
      label: String(label),
      detail: detail === null || detail === undefined ? null : readMetricValue(detail),
    };
  });

const HeatmapArrayPreview = ({ title, items }: { title: string; items: Array<{ id: string; label: string; detail: string | null }> }) => {
  if (!items.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge key={item.id} variant="secondary">
            {item.label}{item.detail ? `: ${item.detail}` : ''}
          </Badge>
        ))}
      </div>
    </div>
  );
};

const EducationOperationsHeatmapPanel = ({ payload }: { payload: EducationOperationsHeatmap }) => {
  const state = payload.render_contract?.state ?? 'empty';
  const heatmapPoints = mapEducationHeatmapPoints(payload.points);
  const metrics = getHeatmapMetrics(payload.summary);
  const bounds = getHeatmapBounds(heatmapPoints);
  const cellPreview = getArrayPreviewItems(payload.cells, 'cell');
  const hotspotPreview = getArrayPreviewItems(payload.hotspots, 'hotspot');
  const canRenderMap = state !== 'empty' && heatmapPoints.length > 0;

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Mapa operativo escolar</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{state}</Badge>
          {payload.render_contract?.map_engine ? (
            <Badge variant="secondary">{payload.render_contract.map_engine}</Badge>
          ) : null}
        </div>
      </div>

      {metrics.length ? (
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((metric) => (
            <div key={metric.key} className="rounded-md border bg-background px-2 py-1.5">
              <p className="text-[11px] text-muted-foreground">{metric.label}</p>
              <p className="text-sm font-semibold text-foreground">{metric.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {canRenderMap ? (
        <MapLibreMap
          className="h-56 rounded-md border"
          center={[heatmapPoints[0].lng, heatmapPoints[0].lat]}
          fitToBounds={bounds}
          heatmapData={heatmapPoints}
          initialZoom={12}
          provider="maplibre"
          showHeatmap
          disableClientClustering
          geoLayerConfig={{
            contract_version: payload.contract_version,
            layers: {
              heatmap: { id: 'education-cases-heat' },
              points: { id: 'education-cases-points' },
            },
          }}
        />
      ) : (
        <p className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
          El contrato no envio puntos escolares con coordenadas para renderizar el mapa.
        </p>
      )}

      {payload.render_contract?.layers?.length ? (
        <div className="flex flex-wrap gap-1">
          {payload.render_contract.layers.map((layer) => (
            <Badge key={layer} variant="outline">{layer}</Badge>
          ))}
        </div>
      ) : null}

      <HeatmapArrayPreview title="Celdas" items={cellPreview} />
      <HeatmapArrayPreview title="Hotspots" items={hotspotPreview} />
    </div>
  );
};

const EducationOperationsSummaryPanel = ({ payload }: { payload: EducationOperationsSummary }) => {
  const metrics = getSummaryMetrics(payload.summary);
  const breakdownEntries = getBreakdownEntries(payload.breakdown);
  const nextBestActions = payload.next_best_actions ?? [];

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Resumen operativo escolar</p>
        <div className="flex flex-wrap gap-1">
          {payload.status ? <Badge variant="outline">{payload.status}</Badge> : null}
          {payload.education_enabled === false ? <Badge variant="destructive">disabled</Badge> : null}
        </div>
      </div>

      {metrics.length ? (
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((metric) => (
            <div key={metric.key} className="rounded-md border bg-background px-2 py-2">
              <p className="text-[11px] text-muted-foreground">{metric.label}</p>
              <p className="text-lg font-semibold text-foreground">{metric.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {breakdownEntries.length ? (
        <div className="space-y-2">
          {breakdownEntries.map((entry) => (
            <div key={entry.key} className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">{entry.label}</p>
              <div className="flex flex-wrap gap-1">
                {entry.items.length ? (
                  entry.items.map(([key, value]) => (
                    <Badge key={`${entry.key}-${key}`} variant="secondary">
                      {humanizeKey(key)}: {readMetricValue(value)}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">sin datos</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {nextBestActions.length ? <EducationOperationsActions actions={nextBestActions} /> : null}
    </div>
  );
};

const readCasePreviewLabel = (item: unknown, index: number) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return `#${index + 1}`;
  const record = item as Record<string, unknown>;
  const candidate =
    record.taxonomy_label ??
    record.title ??
    record.label ??
    record.case_type ??
    record.tipo ??
    record.status ??
    record.estado ??
    record.id;
  return candidate === undefined || candidate === null ? `#${index + 1}` : String(candidate);
};

const readCasePreviewBadges = (item: unknown) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
  const record = item as Record<string, unknown>;
  return [
    record.taxonomy_label,
    record.status ?? record.estado,
    record.channel ?? record.canal,
    record.sensitivity_level ?? record.sensitivity,
    record.assignee_name,
  ].filter((value): value is string | number | boolean => {
    if (value === undefined || value === null) return false;
    return ['string', 'number', 'boolean'].includes(typeof value);
  });
};

const EducationCasesPreview = ({ envelope }: { envelope: EducationCasesListEnvelope }) => (
  <div className="rounded-md border bg-background px-2 py-2">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-foreground">Casos filtrados</span>
      <Badge variant="secondary">{readMetricValue(envelope.count ?? envelope.items.length)}</Badge>
      {envelope.contract_version ? <Badge variant="outline">{envelope.contract_version}</Badge> : null}
    </div>
    {Object.keys(envelope.filters ?? {}).length ? (
      <div className="mt-2 flex flex-wrap gap-1">
        {Object.entries(envelope.filters ?? {}).slice(0, 5).map(([key, value]) => (
          <Badge key={key} variant="outline">
            {humanizeKey(key)}: {readMetricValue(value)}
          </Badge>
        ))}
      </div>
    ) : null}
    {envelope.items.length ? (
      <ul className="mt-2 space-y-2 text-[11px] text-muted-foreground">
        {envelope.items.slice(0, 4).map((item, index) => (
          <li key={`${readCasePreviewLabel(item, index)}-${index}`} className="space-y-1 rounded-md border px-2 py-1.5">
            <p className="truncate text-foreground">{readCasePreviewLabel(item, index)}</p>
            {readCasePreviewBadges(item).length ? (
              <div className="flex flex-wrap gap-1">
                {readCasePreviewBadges(item).slice(0, 4).map((badge, badgeIndex) => (
                  <Badge key={`${badge}-${badgeIndex}`} variant="outline">{String(badge)}</Badge>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    ) : null}
  </div>
);

const EducationOperationsActions = ({ actions }: { actions: EducationOperationsAction[] }) => {
  const { currentSlug } = useTenant();
  const requestOptions = currentSlug ? { tenantSlug: currentSlug } : undefined;
  const casesMutation = useMutation({
    mutationFn: (endpoint?: string | null) => educationApi.openCasesEnvelopeFromEndpoint(endpoint, requestOptions),
  });

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground">Acciones recomendadas</p>
      <div className="space-y-2">
        {actions.slice(0, 4).map((action) => (
          <div key={action.id} className="rounded-md border bg-background px-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-foreground">{action.label || action.id}</span>
              {action.priority ? <Badge variant="outline">{action.priority}</Badge> : null}
            </div>
            {action.endpoint ? <p className="mt-1 break-all text-[11px] text-muted-foreground">{action.endpoint}</p> : null}
            {action.endpoint ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs"
                disabled={casesMutation.isPending}
                onClick={() => casesMutation.mutate(action.endpoint)}
              >
                Abrir casos
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {casesMutation.data ? <EducationCasesPreview envelope={casesMutation.data} /> : null}
      {casesMutation.isError ? (
        <p className="rounded-md border bg-background px-2 py-2 text-[11px] text-destructive">
          No se pudo abrir el listado de casos para la accion seleccionada.
        </p>
      ) : null}
    </div>
  );
};

const ProfileFieldsList = ({ fields }: { fields: EducationProfileField[] }) => (
  <div className="space-y-1">
    {fields.slice(0, 6).map((field) => (
      <p key={field.id} className="text-xs">
        <span className="font-medium text-foreground">{field.label || field.id}:</span>{' '}
        <span>{field.value === undefined || field.value === null ? '-' : String(field.value)}</span>
      </p>
    ))}
  </div>
);

const PanelSectionsList = ({ sections }: { sections: EducationPanelSection[] }) => (
  <div className="flex flex-wrap gap-2">
    {sections.slice(0, 6).map((section) => (
      <Badge key={section.id} variant={section.enabled === false ? 'outline' : 'secondary'}>
        {section.label || section.title || section.id}
      </Badge>
    ))}
  </div>
);

const EducationQuickMenuPreview = ({ items }: { items: EducationQuickMenuItem[] }) => (
  <div className="space-y-2">
    <p className="text-xs font-medium text-foreground">Menu escolar</p>
    <div className="grid gap-2">
      {items.slice(0, 10).map((item) => (
        <div key={item.id} className="rounded-md border bg-muted/20 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-foreground">{item.label}</span>
            {item.intent ? <Badge variant="outline">{item.intent}</Badge> : null}
            {item.requires_handoff ? <Badge variant="destructive">handoff</Badge> : null}
            {item.requires_verification ? <Badge variant="secondary">verificacion</Badge> : null}
            {item.sensitivity_level ? <Badge variant="outline">{item.sensitivity_level}</Badge> : null}
          </div>
          {item.accepted_media?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.accepted_media.map((media) => (
                <Badge key={`${item.id}-${media}`} variant="secondary">{media}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  </div>
);

const EducationWhatsappPreview = ({
  playbook,
  fallbackQuickMenu,
}: {
  playbook: EducationWhatsappPlaybook;
  fallbackQuickMenu: EducationQuickMenuItem[];
}) => {
  const quickMenu = playbook.quick_menu?.length ? playbook.quick_menu : fallbackQuickMenu;
  const starterMessages = playbook.starter_messages ?? [];
  const mediaKeys = playbook.media_intelligence && typeof playbook.media_intelligence === 'object'
    ? Object.keys(playbook.media_intelligence)
    : [];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-medium text-foreground">Preview WhatsApp</p>
        {playbook.welcome ? (
          <p className="mt-2 rounded-lg bg-background px-3 py-2 text-xs text-foreground">{playbook.welcome}</p>
        ) : null}
        {starterMessages.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {starterMessages.slice(0, 4).map((message, index) => {
              const label = typeof message === 'string'
                ? message
                : message.label || message.text || message.id || String(index + 1);
              return (
                <Badge key={`${label}-${index}`} variant="outline" className="max-w-full truncate">
                  {label}
                </Badge>
              );
            })}
          </div>
        ) : null}
        {mediaKeys.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {mediaKeys.map((key) => (
              <Badge key={key} variant="secondary">{key}</Badge>
            ))}
          </div>
        ) : null}
      </div>
      {quickMenu.length ? <EducationQuickMenuPreview items={quickMenu} /> : null}
    </div>
  );
};
