import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { SurveyEditor } from '@/components/surveys/SurveyEditor';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSurveyAdmin } from '@/hooks/useSurveyAdmin';
import type { SurveyDraftPayload } from '@/types/encuestas';
import { toast } from '@/components/ui/use-toast';
import { ALL_SURVEY_TEMPLATES, buildDraftFromTemplate } from '@/config/surveys/templates';
import { useTenant } from '@/context/TenantContext';

const uniquenessLabels: Record<NonNullable<SurveyDraftPayload['politica_unicidad']>, string> = {
  libre: 'Sin restricciones',
  por_cookie: 'Una respuesta por navegador',
  por_ip: 'Una respuesta por IP',
  por_phone: 'Validación por teléfono',
  por_dni: 'Validación por documento',
};

const typeLabels: Record<SurveyDraftPayload['tipo'], string> = {
  opinion: 'Opinión',
  votacion: 'Votación',
  sondeo: 'Sondeo',
  planificacion: 'Planificación',
};

const NewSurveyPage = () => {
  const navigate = useNavigate();
  const { currentSlug } = useTenant();
  const { createSurvey, isSaving } = useSurveyAdmin({ tenantSlug: currentSlug });
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [appliedDraft, setAppliedDraft] = useState<SurveyDraftPayload | null>(null);
  const [editorKey, setEditorKey] = useState(() => `survey-editor-${Date.now()}`);

  const template = useMemo(
    () => ALL_SURVEY_TEMPLATES.find((item) => item.slug === selectedTemplate) ?? null,
    [selectedTemplate],
  );

  const handleApplyTemplate = () => {
    if (!template) {
      toast({ title: 'Elegí una plantilla', description: 'Seleccioná un ejemplo para cargarlo en el editor.' });
      return;
    }

    const draft = buildDraftFromTemplate(template, { municipality });
    setAppliedDraft(draft);
    setEditorKey(`template-${template.slug}-${Date.now()}`);
    toast({
      title: 'Plantilla aplicada',
      description: 'Actualizamos el editor con las preguntas sugeridas. Podés personalizarlas antes de guardar.',
    });
  };

  const handleResetTemplate = () => {
    setAppliedDraft(null);
    setEditorKey(`survey-editor-${Date.now()}`);
  };

  const handleSave = async (payload: SurveyDraftPayload) => {
    try {
      const created = await createSurvey(payload);
      toast({ title: 'Encuesta creada', description: 'Ya podés continuar editando preguntas o publicarla.' });
      navigate(`/admin/encuestas/${created.id}`);
    } catch (error) {
      toast({ title: 'No pudimos crear la encuesta', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plantillas rápidas</CardTitle>
          <CardDescription>Arrancá desde ejemplos listos y personalizalos en segundos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-select">Plantilla sugerida</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template-select">
                  <SelectValue placeholder="Seleccioná un ejemplo" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_SURVEY_TEMPLATES.map((item) => (
                    <SelectItem key={item.slug} value={item.slug}>
                      {item.titulo.replace('{{municipality}}', 'tu ciudad')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-municipality">Localidad o municipio</Label>
              <Input
                id="template-municipality"
                value={municipality}
                onChange={(event) => setMunicipality(event.target.value)}
                placeholder="Ej. Ciudad Demo"
              />
              <p className="text-xs text-muted-foreground">
                Usamos este dato para completar los textos con {'{{municipality}}'} automáticamente.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-dashed p-4">
            {template ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{typeLabels[template.tipo] ?? template.tipo}</Badge>
                  <Badge variant="outline">{uniquenessLabels[template.politica_unicidad] ?? 'Revisión manual'}</Badge>
                  {template.tags?.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{template.descripcion}</p>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Preguntas destacadas</p>
                  <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                    {template.preguntas.slice(0, 3).map((pregunta) => (
                      <li key={pregunta.orden} className="line-clamp-2">
                        {pregunta.orden}.{' '}
                        {pregunta.texto.replace('{{municipality}}', municipality || 'tu ciudad')}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Seleccioná una plantilla para ver las preguntas sugeridas y los controles de participación recomendados.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleApplyTemplate} disabled={!template}>
              Aplicar plantilla
            </Button>
            <Button variant="ghost" onClick={handleResetTemplate} disabled={!appliedDraft && !template}>
              Limpiar selección
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nueva encuesta</CardTitle>
          <CardDescription>Definí el formulario, las preguntas y las reglas de participación.</CardDescription>
        </CardHeader>
        <CardContent>
          <SurveyEditor
            key={editorKey}
            onSave={handleSave}
            isSaving={isSaving}
            initialDraft={appliedDraft ?? undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default NewSurveyPage;
