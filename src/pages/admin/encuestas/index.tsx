import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Loader2, MessageSquareText, Plus, Radio } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { SurveyCard } from '@/components/surveys/SurveyCard';
import { Button } from '@/components/ui/button';
import { useSurveyAdmin } from '@/hooks/useSurveyAdmin';
import type { SurveyAdmin } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import { getPublicSurveyUrlFromRecord } from '@/utils/publicSurveyUrl';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import { prioritizeMendozaDemoSurveys } from '@/utils/surveyDemoPriority';

type SurveyFocusMode = 'live' | 'comments' | null;

const normalizeFocusMode = (value: string | null): SurveyFocusMode => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'live' || normalized === 'realtime' || normalized === 'votaciones') return 'live';
  if (normalized === 'comments' || normalized === 'comentarios' || normalized === 'debate') return 'comments';
  return null;
};

const matchesFocus = (survey: SurveyAdmin, focusMode: SurveyFocusMode) => {
  if (!focusMode) return false;
  if (focusMode === 'live') {
    return Boolean(
      survey.es_votacion_envivo ||
        survey.mostrar_resultados_envivo ||
        survey.tipo === 'votacion',
    );
  }
  return Boolean(survey.permitir_comentarios);
};

const focusCopy = {
  live: {
    title: 'Foco operativo: votaciones y resultados en vivo',
    description: 'Priorizamos encuestas con live results para que el equipo vea actividad, mapa y senales IA sin buscar manualmente.',
    badge: 'Live',
    empty: 'No hay votaciones en vivo activas para este tenant.',
    icon: Radio,
  },
  comments: {
    title: 'Foco operativo: comentarios ciudadanos',
    description: 'Priorizamos encuestas con debate habilitado para responder y moderar conversaciones publicas.',
    badge: 'Comentarios',
    empty: 'No hay encuestas con comentarios habilitados.',
    icon: MessageSquareText,
  },
} satisfies Record<Exclude<SurveyFocusMode, null>, {
  title: string;
  description: string;
  badge: string;
  empty: string;
  icon: LucideIcon;
}>;

const AdminSurveysIndex = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusMode = normalizeFocusMode(searchParams.get('focus'));
  const { surveys, isLoadingList, listError, publishSurvey, deleteSurvey, seedSurvey, isPublishing, isDeleting, isSeeding, refetchList } =
    useSurveyAdmin();
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [seedingId, setSeedingId] = useState<number | null>(null);

  const handlePublish = async (survey: SurveyAdmin) => {
    try {
      setPublishingId(survey.id);
      await publishSurvey(survey.id);
      toast({ title: 'Encuesta publicada', description: 'Ya podés compartir el enlace público.' });
      await refetchList();
    } catch (error) {
      toast({ title: 'No pudimos publicar la encuesta', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    } finally {
      setPublishingId(null);
    }
  };

  const handleCopyLink = async (survey: SurveyAdmin) => {
    const publicUrl = getPublicSurveyUrlFromRecord(survey);
    if (!publicUrl) {
      toast({
        title: 'No se pudo generar el enlace público',
        description: 'Verificá que la encuesta tenga un slug configurado.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: 'Link copiado', description: 'Compartilo en redes, mailings o un QR impreso.' });
    } catch (error) {
      toast({ title: 'No se pudo copiar el enlace', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const handleDelete = async (survey: SurveyAdmin) => {
    try {
      setDeletingId(survey.id);
      await deleteSurvey(survey.id);
      toast({ title: 'Encuesta eliminada', description: 'La encuesta se borró correctamente.' });
      await refetchList();
    } catch (error) {
      toast({
        title: 'No pudimos borrar la encuesta',
        description: String((error as Error)?.message ?? error),
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSeed = async (survey: SurveyAdmin) => {
    try {
      setSeedingId(survey.id);
      const result = await seedSurvey(survey.id, { cantidad: 100, reset: true });
      toast({
        title: 'Datos generados',
        description: `Se agregaron ${result.creadas} respuestas de prueba.`
      });
      // Optionally refresh analytics data if needed, but refetchList might not be enough if it doesn't return analytics counts
      await refetchList();
    } catch (error) {
      toast({
        title: 'Error al generar datos',
        description: String((error as Error)?.message ?? error),
        variant: 'destructive',
      });
    } finally {
      setSeedingId(null);
    }
  };

  const items = useMemo(() => {
    const prioritized = prioritizeMendozaDemoSurveys(surveys?.data ?? []);
    if (!focusMode) return prioritized;
    return [...prioritized].sort((a, b) => Number(matchesFocus(b, focusMode)) - Number(matchesFocus(a, focusMode)));
  }, [focusMode, surveys?.data]);
  const focusedItems = useMemo(
    () => (focusMode ? items.filter((survey) => matchesFocus(survey, focusMode)) : []),
    [focusMode, items],
  );
  const focusMeta = focusMode ? focusCopy[focusMode] : null;
  const FocusIcon = focusMeta?.icon;
  const firstFocusedSurvey = focusedItems[0];

  return (
    <SectionErrorBoundary
      title="No pudimos cargar las encuestas"
      description="Reintentá o volvé al inicio mientras recuperamos el panel de encuestas."
      onRetry={() => refetchList()}
    >
      <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Encuestas ciudadanas</h1>
          <p className="text-sm text-muted-foreground">Diseñá, gestioná y difundí instancias de participación desde un solo lugar.</p>
        </div>
        <Button onClick={() => navigate('/admin/encuestas/new')} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nueva encuesta
        </Button>
      </div>

      {focusMeta ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              {FocusIcon ? (
                <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
                  <FocusIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              ) : null}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{focusMeta.title}</h2>
                  <span className="rounded-full border border-primary/25 bg-background px-2 py-0.5 text-xs text-primary">
                    {focusedItems.length} priorizadas
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{focusMeta.description}</p>
                {!focusedItems.length ? (
                  <p className="mt-2 text-xs text-amber-600">{focusMeta.empty}</p>
                ) : null}
              </div>
            </div>
            {firstFocusedSurvey ? (
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => navigate(`/admin/encuestas/${firstFocusedSurvey.id}/analytics?focus=${focusMode}`)}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Abrir analytics
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {listError && <p className="text-sm text-destructive">{listError}</p>}

      {isLoadingList ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((survey) => (
            <div key={survey.id} className={focusMode && matchesFocus(survey, focusMode) ? 'rounded-2xl border border-primary/25 bg-primary/[0.03] p-2' : undefined}>
              {focusMode && matchesFocus(survey, focusMode) ? (
                <div className="mb-2 inline-flex rounded-full border border-primary/25 bg-background px-2 py-0.5 text-xs font-medium text-primary">
                  {focusMeta?.badge}
                </div>
              ) : null}
              <SurveyCard
                survey={survey}
                onEdit={() => navigate(`/admin/encuestas/${survey.id}`)}
                onAnalytics={() => navigate(`/admin/encuestas/${survey.id}/analytics${focusMode ? `?focus=${focusMode}` : ''}`)}
                onPublish={survey.estado !== 'publicada' ? () => handlePublish(survey) : undefined}
                publishing={isPublishing && publishingId === survey.id}
                onCopyLink={survey.estado === 'publicada' ? () => handleCopyLink(survey) : undefined}
                onDelete={() => handleDelete(survey)}
                deleting={isDeleting && deletingId === survey.id}
                onSeed={() => handleSeed(survey)}
                seeding={isSeeding && seedingId === survey.id}
              />
            </div>
          ))}
          {!items.length && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Todavía no cargaste encuestas. Creá una nueva para comenzar la fase de participación.
            </div>
          )}
        </div>
      )}
      </div>
    </SectionErrorBoundary>
  );
};

export default AdminSurveysIndex;
