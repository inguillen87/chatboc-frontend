import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { CalendarDays, Copy, Download, Loader2 } from 'lucide-react';

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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getErrorMessage } from '@/utils/api';

const formatDateLabel = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
};

const SurveyAnalyticsPage = () => {
  const params = useParams();
  const surveyId = useMemo(() => (params.id ? Number(params.id) : null), [params.id]);
  const { survey, isLoadingSurvey, surveyError } = useSurveyAdmin({ id: surveyId ?? undefined });
  const { summary, timeseries, heatmap, isLoading, exportCsv, isExporting, filters, setFilters } =
    useSurveyAnalytics(surveyId ?? undefined, {}, { fallbackSurvey: survey ?? null, fallbackCount: 100 });
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

  const publicUrl = useMemo(
    () => (survey?.slug ? getAbsolutePublicSurveyUrl(survey.slug) : null),
    [survey?.slug],
  );
  const qrUrl = survey?.slug ? getPublicSurveyQrUrl(survey.slug, { size: 512 }) : null;
  const rangeLabel = useMemo(() => {
    const start = formatDateLabel(survey?.inicio_at);
    const end = formatDateLabel(survey?.fin_at);
    if (start && end) return `${start} – ${end}`;
    return start || end || 'Sin rango definido';
  }, [survey?.fin_at, survey?.inicio_at]);

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
      const filename = survey ? `encuesta-${survey.slug}-analytics.csv` : 'encuesta-analytics.csv';
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
    if (!survey) return;
    try {
      const result = await seedSurveyResponses({ survey, count: 100 });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['survey-analytics-summary', survey.id] }),
        queryClient.invalidateQueries({ queryKey: ['survey-analytics-timeseries', survey.id] }),
        queryClient.invalidateQueries({ queryKey: ['survey-analytics-heatmap', survey.id] }),
        queryClient.invalidateQueries({ queryKey: ['survey-responses', survey.id] }),
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

  if (isLoadingSurvey || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!survey || surveyError) {
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
              Estado: {survey.estado}
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
                  slug={survey.slug}
                  title={survey.titulo}
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
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Analítica de {survey.titulo}</CardTitle>
              <CardDescription>
                Explorá la evolución de las respuestas, canales de difusión y trazabilidad pública.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                void handleSeedDemoResponses();
              }}
              disabled={isSeeding || !survey.slug}
              className="inline-flex items-center gap-2"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generando respuestas…
                </>
              ) : (
                'Inyectar 100 respuestas demo'
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SurveyAnalytics
            summary={summary}
            timeseries={timeseries}
            heatmap={heatmap}
            onExport={handleExport}
            isExporting={isExporting}
          />
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
