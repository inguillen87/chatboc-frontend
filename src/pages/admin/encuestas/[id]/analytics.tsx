import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, Copy, Download, ExternalLink, Loader2, Sparkles, TrendingUp } from 'lucide-react';

import { SurveyAnalytics } from '@/components/surveys/SurveyAnalytics';
import { SurveyQrPreview } from '@/components/surveys/SurveyQrPreview';
import { SurveyRecentResponses } from '@/components/surveys/SurveyRecentResponses';
import { TransparencyTab } from '@/components/surveys/TransparencyTab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSurveyAdmin } from '@/hooks/useSurveyAdmin';
import { useSurveyAnalytics } from '@/hooks/useSurveyAnalytics';
import { useAnchor } from '@/hooks/useAnchor';
import { useSurveyResponses } from '@/hooks/useSurveyResponses';
import { useSurveySeedResponses } from '@/hooks/useSurveySeedResponses';
import { toast } from '@/components/ui/use-toast';
import { getAbsolutePublicSurveyUrl, getPublicSurveyQrUrl } from '@/utils/publicSurveyUrl';
import { getSurveyAlerts, getSurveyAnomalies, getSurveyBrief, getSurveyForecast, getSurveySegmentsCompare } from '@/api/encuestas';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getErrorMessage } from '@/utils/api';
import { enterpriseService } from '@/services/enterpriseService';

const formatDateLabel = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
};

const asSafeText = (value?: unknown) => (typeof value === 'string' ? value : '');

const asRenderableText = (value?: unknown) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  const candidates = [record.texto, record.text, record.label, record.title, record.message, record.summary];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate);
  }

  return '';
};

const renderLabeledMetric = (label: string, value: string | number) => {
  if (label.trim()) {
    return (
      <p>
        {label}: <strong>{value}</strong>
      </p>
    );
  }

  return (
    <p>
      <strong>{value}</strong>
    </p>
  );
};

const SurveyAnalyticsPage = () => {
  const params = useParams();
  const surveyId = useMemo(() => (params.id ? Number(params.id) : null), [params.id]);
  const { survey, surveys, isLoadingSurvey, surveyError } = useSurveyAdmin({ id: surveyId ?? undefined });
  const {
    summary,
    timeseries,
    heatmap,
    heatmapMeta,
    dashboardBundle,
    executiveSummary,
    isLoading,
    exportCsv,
    isExporting,
    filters,
    setFilters,
    error: analyticsError,
  } = useSurveyAnalytics(surveyId ?? undefined, {}, { fallbackSurvey: survey ?? null, fallbackCount: 100 });
  const { snapshots, isLoading: loadingSnapshots, create, publish, verify, isCreating, isPublishing, isVerifying } =
    useAnchor(surveyId ?? undefined);
  const {
    responses,
    isLoading: isLoadingResponses,
    isRefetching: isRefreshingResponses,
    error: responsesError,
    refetch: refetchResponses,
  } = useSurveyResponses(surveyId ?? undefined);
  const queryClient = useQueryClient();
  const { seed: seedSurveyResponses, isSeeding } = useSurveySeedResponses();

  const forecastQuery = useQuery({
    queryKey: ['survey-analytics-forecast', surveyId],
    enabled: Boolean(surveyId),
    queryFn: () => getSurveyForecast(surveyId as number, { window_minutes: 15, horizon_minutes: 90 }),
    staleTime: 30_000,
  });
  const alertsQuery = useQuery({
    queryKey: ['survey-analytics-alerts', surveyId],
    enabled: Boolean(surveyId),
    queryFn: () => getSurveyAlerts(surveyId as number, { window_minutes: 15, min_activity: 5 }),
    staleTime: 15_000,
  });
  const briefQuery = useQuery({
    queryKey: ['survey-analytics-brief', surveyId],
    enabled: Boolean(surveyId),
    queryFn: () => getSurveyBrief(surveyId as number),
    staleTime: 60_000,
  });
  const compareQuery = useQuery({
    queryKey: ['survey-analytics-segments-compare', surveyId],
    enabled: Boolean(surveyId),
    queryFn: () => getSurveySegmentsCompare(surveyId as number, { a_canal: 'web', b_canal: 'whatsapp' }),
    staleTime: 30_000,
  });
  const anomaliesQuery = useQuery({
    queryKey: ['survey-analytics-anomalies', surveyId],
    enabled: Boolean(surveyId),
    queryFn: () => getSurveyAnomalies(surveyId as number, { burst_window_minutes: 5, burst_threshold: 10 }),
    staleTime: 30_000,
  });

  const surveyFromList = useMemo(() => {
    if (!surveyId || !surveys?.data?.length) return undefined;
    return surveys.data.find((item) => item.id === surveyId);
  }, [surveyId, surveys?.data]);
  const effectiveSurvey = survey ?? surveyFromList;

  useEffect(() => {
    if (!surveyId) return;
    void enterpriseService.trackEvent(
      {
        event: 'analytics_dashboard_loaded',
        payload: {
          tenant_slug: effectiveSurvey?.tenant_slug || null,
          route: '/admin/encuestas/:id/analytics',
          build_version: import.meta.env.VITE_APP_VERSION || 'dev',
          survey_id: surveyId,
        },
      },
      effectiveSurvey?.tenant_slug,
    ).catch(() => undefined);
  }, [surveyId, effectiveSurvey?.tenant_slug]);

  const publicUrl = useMemo(
    () => (effectiveSurvey?.slug ? getAbsolutePublicSurveyUrl(effectiveSurvey.slug) : null),
    [effectiveSurvey?.slug],
  );
  const qrUrl = effectiveSurvey?.slug ? getPublicSurveyQrUrl(effectiveSurvey.slug, { size: 512 }) : null;
  const rangeLabel = useMemo(() => {
    const start = formatDateLabel(effectiveSurvey?.inicio_at);
    const end = formatDateLabel(effectiveSurvey?.fin_at);
    if (start && end) return `${start} – ${end}`;
    return start || end || 'Sin rango definido';
  }, [effectiveSurvey?.fin_at, effectiveSurvey?.inicio_at]);

  const enterpriseUiConfig = useMemo(
    () => ((effectiveSurvey?.recursos as Record<string, unknown> | undefined)?.analytics_enterprise_ui as Record<string, unknown>) ?? {},
    [effectiveSurvey?.recursos],
  );
  
  const demographicFilterOptions = useMemo(() => {
    const breakdowns = summary?.demografia ?? {};
    const buildOptions = (keys: string[]) => {
      for (const key of keys) {
        const items = breakdowns[key];
        if (!Array.isArray(items) || !items.length) continue;
        const normalized = items
          .map((item) => {
            const rawValue = item?.clave ?? item?.etiqueta;
            if (rawValue === undefined || rawValue === null || rawValue === '') {
              return null;
            }
            const value = String(rawValue);
            const label = String(item?.etiqueta ?? rawValue);
            return { value, label };
          })
          .filter((option): option is { value: string; label: string } => Boolean(option));
        if (!normalized.length) continue;
        const unique = normalized.filter(
          (option, index, array) => array.findIndex((candidate) => candidate.value === option.value) === index,
        );
        if (unique.length) {
          return unique;
        }
      }
      return [] as Array<{ value: string; label: string }>;
    };

    return {
      genero: buildOptions(['genero', 'generos']),
      rango_etario: buildOptions(['rango_etario', 'rangos_etarios', 'rangoEtario', 'rangosEtarios']),
      pais: buildOptions(['pais', 'paises']),
      provincia: buildOptions(['provincia', 'provincias']),
      ciudad: buildOptions(['ciudad', 'ciudades']),
      barrio: buildOptions(['barrio', 'barrios']),
    };
  }, [summary?.demografia]);

  const SELECT_ALL = '__all__';

  const demographicFilterConfig: Array<{
    key: 'genero' | 'rango_etario' | 'pais' | 'provincia' | 'ciudad' | 'barrio';
    label: string;
    placeholder: string;
    options: Array<{ value: string; label: string }>;
  }> = [
    {
      key: 'genero',
      label: 'Género',
      placeholder: 'Todos los géneros',
      options: demographicFilterOptions.genero,
    },
    {
      key: 'rango_etario',
      label: 'Rango etario',
      placeholder: 'Todos los rangos',
      options: demographicFilterOptions.rango_etario,
    },
    {
      key: 'pais',
      label: 'País',
      placeholder: 'Todos los países',
      options: demographicFilterOptions.pais,
    },
    {
      key: 'provincia',
      label: 'Provincia',
      placeholder: 'Todas las provincias',
      options: demographicFilterOptions.provincia,
    },
    {
      key: 'ciudad',
      label: 'Ciudad',
      placeholder: 'Todas las ciudades',
      options: demographicFilterOptions.ciudad,
    },
    {
      key: 'barrio',
      label: 'Barrio',
      placeholder: 'Todos los barrios',
      options: demographicFilterOptions.barrio,
    },
  ];

  const hasDemographicOptions = demographicFilterConfig.some((config) => config.options.length > 0);
  const hasActiveDemographicFilters = Boolean(
    filters.genero ||
      filters.rango_etario ||
      filters.pais ||
      filters.provincia ||
      filters.ciudad ||
      filters.barrio,
  );

  const handleDemographicFilterChange = (
    field: 'genero' | 'rango_etario' | 'pais' | 'provincia' | 'ciudad' | 'barrio',
    value: string,
  ) => {
    const normalizedValue = value === SELECT_ALL ? undefined : value;
    setFilters({
      ...filters,
      [field]: normalizedValue,
    });
  };

  const clearDemographicFilters = () => {
    setFilters({
      ...filters,
      genero: undefined,
      rango_etario: undefined,
      pais: undefined,
      provincia: undefined,
      ciudad: undefined,
      barrio: undefined,
    });
  };

  const handleExport = async () => {
    try {
      const blob = await exportCsv();
      const filename = effectiveSurvey ? `encuesta-${effectiveSurvey.slug}-analytics.csv` : 'encuesta-analytics.csv';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportación lista', description: 'Descargaste la analítica en formato CSV.' });
    } catch (error) {
      toast({ title: 'No pudimos exportar los datos', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const handleCreateSnapshot = async (payload?: { rango?: string }) => {
    try {
      await create(payload);
      toast({ title: 'Snapshot creado', description: 'Guardamos un corte transparente de resultados.' });
    } catch (error) {
      toast({ title: 'No se pudo crear el snapshot', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const handlePublishSnapshot = async (snapshotId: number) => {
    try {
      await publish(snapshotId);
      toast({ title: 'Snapshot publicado', description: 'Ahora cualquiera puede auditar este corte.' });
    } catch (error) {
      toast({ title: 'No se pudo publicar el snapshot', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const handleVerify = async (snapshotId: number, respuestaId: number) => {
    try {
      const result = await verify(snapshotId, respuestaId);
      toast({
        title: 'Verificación realizada',
        description: result.valido
          ? 'La respuesta figura en el snapshot seleccionado.'
          : 'No encontramos esa respuesta en el snapshot.',
      });
      return result;
    } catch (error) {
      toast({ title: 'No se pudo verificar la respuesta', description: String((error as Error)?.message ?? error), variant: 'destructive' });
      throw error;
    }
  };

  const handleSeedDemoResponses = async () => {
    if (!effectiveSurvey) return;
    try {
      const result = await seedSurveyResponses({ survey: effectiveSurvey, count: 100 });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['survey-analytics-summary', effectiveSurvey.id] }),
        queryClient.invalidateQueries({ queryKey: ['survey-analytics-timeseries', effectiveSurvey.id] }),
        queryClient.invalidateQueries({ queryKey: ['survey-analytics-heatmap', effectiveSurvey.id] }),
        queryClient.invalidateQueries({ queryKey: ['survey-responses', effectiveSurvey.id] }),
      ]);

      void refetchResponses();

      toast({
        title: 'Respuestas demo generadas',
        description:
          result.failures > 0
            ? `Registramos ${result.success} de ${result.total} respuestas. ${result.failures} intentos fallaron.`
            : `Registramos ${result.success} respuestas de demostración.`,
      });
    } catch (error) {
      toast({
        title: 'No se pudieron generar respuestas demo',
        description: getErrorMessage(error, 'Intentá nuevamente en unos minutos.'),
        variant: 'destructive',
      });
    }
  };

  const forecast = forecastQuery.data;
  const alerts = alertsQuery.data ?? [];
  const brief = briefQuery.data;
  const segmentsCompare = compareQuery.data;
  const anomalies = anomaliesQuery.data;
  const responsesTotalHint = typeof summary?.total_respuestas === 'number' ? summary.total_respuestas : null;
  const backendAlerts = dashboardBundle?.modules?.alerts ?? [];
  const effectiveAlerts = backendAlerts.length ? backendAlerts : alerts;
  const backendBrief = dashboardBundle?.modules?.brief;
  const effectiveBrief = backendBrief ?? brief;

  if ((isLoadingSurvey && !surveys) || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!effectiveSurvey) {
    return <p className="text-sm text-destructive">{surveyError || 'No encontramos esta encuesta.'}</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Difusión y acceso público</CardTitle>
          <CardDescription>Copiá el enlace y compartí el QR para recibir nuevas respuestas rápidamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="outline" className="uppercase tracking-wide">
              Estado: {effectiveSurvey.estado}
            </Badge>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {rangeLabel}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Enlace público</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <span className="truncate">
                        {publicUrl || 'Configurá el slug público para generar el enlace compartible.'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!publicUrl) return;
                        try {
                          await navigator.clipboard.writeText(publicUrl);
                          toast({
                            title: 'Link copiado',
                            description: 'Listo para compartir por WhatsApp, redes o correo.',
                          });
                        } catch (error) {
                          toast({
                            title: 'No se pudo copiar el enlace',
                            description: String((error as Error)?.message ?? error),
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="inline-flex items-center gap-2"
                      disabled={!publicUrl}
                    >
                      <Copy className="h-4 w-4" /> Copiar link
                    </Button>
                    {qrUrl ? (
                      <Button variant="outline" asChild className="inline-flex items-center gap-2">
                        <a href={qrUrl} download>
                          <Download className="h-4 w-4" /> Descargar QR
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Compartí el enlace en WhatsApp, redes sociales o insertalo en tu sitio para maximizar la participación.
              </p>
            </div>
            {qrUrl ? (
              <div className="flex flex-col items-center gap-2">
                <SurveyQrPreview
                  slug={effectiveSurvey.slug}
                  title={effectiveSurvey.titulo}
                  remoteUrl={qrUrl}
                  size={160}
                  imageClassName="bg-white p-4"
                />
                <span className="text-xs text-muted-foreground">Escaneá para probar el recorrido público.</span>
              </div>
            ) : null}
          </div>
      </CardContent>
    </Card>
      <Card>
        <CardHeader>
          <CardTitle>Filtros demográficos y territoriales</CardTitle>
          <CardDescription>Segmentá los tableros por género, edad o ubicación declarada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasDemographicOptions ? (
            <div className="grid gap-4 md:grid-cols-3">
              {demographicFilterConfig.map((config) => (
                <div key={config.key} className="space-y-2">
                  <Label htmlFor={`analytics-filter-${config.key}`}>{config.label}</Label>
                  <Select
                    value={(filters[config.key] as string | undefined) ?? SELECT_ALL}
                    onValueChange={(value) => handleDemographicFilterChange(config.key, value)}
                    disabled={!config.options.length}
                  >
                    <SelectTrigger id={`analytics-filter-${config.key}`}>
                      <SelectValue placeholder={config.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_ALL}>{config.placeholder}</SelectItem>
                      {config.options.map((option) => (
                        <SelectItem key={`${config.key}-${option.value}`} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Los filtros aparecerán automáticamente cuando se registren respuestas con datos demográficos o territoriales.
            </p>
          )}
          {hasActiveDemographicFilters ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearDemographicFilters}>
                Limpiar filtros
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {executiveSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>{asRenderableText(executiveSummary.headline)}</CardTitle>
            <CardDescription>{asRenderableText(executiveSummary.one_liner)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.isArray(executiveSummary.focus_points) && executiveSummary.focus_points.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {executiveSummary.focus_points.slice(0, 6).map((focusPoint, index) => (
                  <li key={`${index}-${asRenderableText(focusPoint)}`}>{asRenderableText(focusPoint)}</li>
                ))}
              </ul>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <p className="text-muted-foreground">alert_count</p>
                <p className="text-xl font-semibold">{executiveSummary.alert_count ?? effectiveAlerts.length ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3 text-sm">
                <p className="text-muted-foreground">projected_additional</p>
                <p className="text-xl font-semibold">{executiveSummary.projected_additional ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div className="sticky top-3 z-20 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">Centro de acciones de analytics</p>
            <p className="text-xs text-muted-foreground">Exportá, difundí y generá demo sin salir de la vista.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void handleSeedDemoResponses();
              }}
              disabled={isSeeding || !effectiveSurvey.slug}
              className="inline-flex items-center gap-2"
            >
              {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} 100 demo
            </Button>
            {publicUrl ? (
              <Button variant="outline" size="sm" asChild className="inline-flex items-center gap-2">
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Pública
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Analítica de {effectiveSurvey.titulo}</CardTitle>
              <CardDescription>
                Explorá la evolución de las respuestas, canales de difusión y trazabilidad pública.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {analyticsError && !isLoading ? (
            <p className="mb-4 text-sm text-destructive">
              {analyticsError}
            </p>
          ) : null}
          <SurveyAnalytics
            summary={summary}
            timeseries={timeseries}
            heatmap={heatmap}
            heatmapMeta={heatmapMeta}
            onExport={handleExport}
            isExporting={isExporting}
            filters={filters}
            onFiltersChange={setFilters}
            tenantSlug={effectiveSurvey?.tenant_slug}
            route="/admin/encuestas/:id/analytics"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{asSafeText(enterpriseUiConfig?.command_center_title)}</CardTitle>
          <CardDescription>{asSafeText(enterpriseUiConfig?.command_center_description)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" /> {asSafeText(enterpriseUiConfig?.forecast_title)}
              </div>
              {forecastQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : forecastQuery.error ? (
                <p className="text-sm text-destructive">{getErrorMessage(forecastQuery.error)}</p>
              ) : (
                <div className="space-y-1 text-sm">
                  {renderLabeledMetric(asSafeText(enterpriseUiConfig?.forecast_projected_total_label), forecast?.projected_total ?? '—')}
                  {renderLabeledMetric(asSafeText(enterpriseUiConfig?.forecast_current_rate_label), forecast?.current_rate ?? '—')}
                  {renderLabeledMetric(asSafeText(enterpriseUiConfig?.forecast_confidence_label), forecast?.confidence ?? '—')}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border/60 p-4 md:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> {asSafeText(enterpriseUiConfig?.alerts_title)}
              </div>
              {alertsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : alertsQuery.error ? (
                <p className="text-sm text-destructive">{getErrorMessage(alertsQuery.error)}</p>
              ) : effectiveAlerts.length ? (
                <div className="space-y-2">
                  {effectiveAlerts.slice(0, 6).map((alert, index) => (
                    <div key={`${alert.id ?? index}`} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{asRenderableText(alert.severity) || 'info'}</Badge>
                        <span className="font-medium">{asRenderableText(alert.title)}</span>
                      </div>
                      <p className="text-muted-foreground">{asRenderableText(alert.message)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{asSafeText(enterpriseUiConfig?.alerts_empty_label)}</p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" /> {asSafeText(enterpriseUiConfig?.brief_title)}
            </div>
            {briefQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : briefQuery.error ? (
              <p className="text-sm text-destructive">{getErrorMessage(briefQuery.error)}</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p>{asRenderableText(effectiveBrief?.summary) || asSafeText(enterpriseUiConfig?.brief_fallback_label)}</p>
                {effectiveBrief?.highlights?.length ? (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {effectiveBrief.highlights.slice(0, 4).map((item, index) => (
                      <li key={`${index}-${asRenderableText(item)}`}>{asRenderableText(item)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{asSafeText(enterpriseUiConfig?.territorial_center_title)}</CardTitle>
          <CardDescription>{asSafeText(enterpriseUiConfig?.territorial_center_description)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border/60 p-4">
            <p className="mb-2 text-sm font-medium">{asSafeText(enterpriseUiConfig?.segment_comparator_title)}</p>
            {compareQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{asSafeText(enterpriseUiConfig?.loading_label)}</p>
            ) : compareQuery.error ? (
              <p className="text-sm text-destructive">{getErrorMessage(compareQuery.error)}</p>
            ) : segmentsCompare?.buckets?.length ? (
              <div className="space-y-2">
                {segmentsCompare.buckets.slice(0, 6).map((bucket, index) => (
                  <div key={`${bucket.question_id ?? index}`} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{asRenderableText(bucket.question_text)}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-primary/10 px-2 py-1">{asRenderableText(segmentsCompare.segment_a_label)}: {bucket.segment_a ?? 0}</div>
                      <div className="rounded bg-amber-500/10 px-2 py-1">{asRenderableText(segmentsCompare.segment_b_label)}: {bucket.segment_b ?? 0}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{asSafeText(enterpriseUiConfig?.segment_comparator_empty_label)}</p>
            )}
          </div>
          <div className="rounded-lg border border-border/60 p-4">
            <p className="mb-2 text-sm font-medium">{asSafeText(enterpriseUiConfig?.data_quality_title)}</p>
            {anomaliesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{asSafeText(enterpriseUiConfig?.loading_label)}</p>
            ) : anomaliesQuery.error ? (
              <p className="text-sm text-destructive">{getErrorMessage(anomaliesQuery.error)}</p>
            ) : (
              <div className="space-y-2 text-sm">
                {renderLabeledMetric(asSafeText(enterpriseUiConfig?.risk_score_label), anomalies?.risk_score ?? '—')}
                {renderLabeledMetric(asSafeText(enterpriseUiConfig?.risk_level_label), anomalies?.risk_level ?? '—')}
                {anomalies?.signals?.length ? (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {anomalies.signals.slice(0, 6).map((signal, index) => (
                      <li key={`${signal.id ?? index}`}>{asRenderableText(signal.type)}: {asRenderableText(signal.detail)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{asSafeText(enterpriseUiConfig?.data_quality_empty_label)}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <SurveyRecentResponses
        responses={responses}
        loading={isLoadingResponses}
        refreshing={isRefreshingResponses}
        error={responsesError}
        onRefresh={() => {
          void refetchResponses();
        }}
        emptyHintUrl={publicUrl}
        totalResponsesHint={responsesTotalHint}
      />
      <Card>
        <CardHeader>
          <CardTitle>Transparencia y auditoría</CardTitle>
          <CardDescription>Gestioná snapshots verificables y permití validar respuestas puntuales.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSnapshots ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <TransparencyTab
              snapshots={snapshots}
              onCreateSnapshot={handleCreateSnapshot}
              onPublishSnapshot={handlePublishSnapshot}
              onVerifyResponse={handleVerify}
              isCreating={isCreating}
              isPublishing={isPublishing}
              isVerifying={isVerifying}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SurveyAnalyticsPage;
