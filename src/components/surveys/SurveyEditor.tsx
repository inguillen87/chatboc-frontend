import { useEffect, useMemo, useState } from 'react';
import { Reorder } from 'framer-motion';
import { CalendarDays, Copy, GripVertical, Plus, Trash2, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import type {
  PreguntaTipo,
  SurveyAdmin,
  SurveyDraftPayload,
  SurveyTipo,
} from '@/types/encuestas';
import { getAbsolutePublicSurveyUrl } from '@/utils/publicSurveyUrl';

interface SurveyEditorProps {
  survey?: SurveyAdmin;
  onSave: (payload: SurveyDraftPayload) => Promise<void>;
  onPublish?: () => Promise<void>;
  isSaving?: boolean;
  isPublishing?: boolean;
}

interface LocalOption {
  localId: string;
  id?: number;
  orden: number;
  texto: string;
  valor?: string;
}

interface LocalQuestion {
  localId: string;
  id?: number;
  orden: number;
  tipo: PreguntaTipo;
  texto: string;
  obligatoria: boolean;
  min_selecciones?: number | null;
  max_selecciones?: number | null;
  opciones?: LocalOption[];
}

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createLocalOption = (index: number, partial?: Partial<LocalOption>): LocalOption => ({
  localId: generateId(),
  orden: index,
  texto: '',
  ...partial,
});

const createLocalQuestion = (index: number, partial?: Partial<LocalQuestion>): LocalQuestion => ({
  localId: generateId(),
  orden: index,
  tipo: 'opcion_unica',
  texto: 'Nueva pregunta',
  obligatoria: true,
  opciones: [createLocalOption(1), createLocalOption(2)],
  ...partial,
});

const mapSurveyToLocal = (survey?: SurveyAdmin): LocalQuestion[] =>
  survey?.preguntas?.map((pregunta) => ({
    localId: generateId(),
    id: pregunta.id,
    orden: pregunta.orden,
    tipo: pregunta.tipo,
    texto: pregunta.texto,
    obligatoria: pregunta.obligatoria,
    min_selecciones: pregunta.min_selecciones ?? null,
    max_selecciones: pregunta.max_selecciones ?? null,
    opciones: pregunta.opciones?.map((opcion) => ({
      localId: generateId(),
      id: opcion.id,
      orden: opcion.orden,
      texto: opcion.texto,
      valor: opcion.valor,
    })),
  })) ?? [];

const tipoOptions: Array<{ value: SurveyTipo; label: string }> = [
  { value: 'opinion', label: 'Opinión' },
  { value: 'votacion', label: 'Votación' },
  { value: 'sondeo', label: 'Sondeo' },
];

const preguntaTipoOptions: Array<{ value: PreguntaTipo; label: string }> = [
  { value: 'opcion_unica', label: 'Opción única' },
  { value: 'multiple', label: 'Selección múltiple' },
  { value: 'abierta', label: 'Respuesta abierta' },
];

const unicidadOptions = [
  { value: 'libre', label: 'Sin restricciones' },
  { value: 'por_cookie', label: 'Una respuesta por navegador' },
  { value: 'por_ip', label: 'Una respuesta por IP' },
  { value: 'por_phone', label: 'Validar por teléfono' },
  { value: 'por_dni', label: 'Validar por documento' },
];

const fallbackDraft: SurveyDraftPayload = {
  titulo: '',
  slug: '',
  descripcion: '',
  tipo: 'opinion',
  inicio_at: '',
  fin_at: '',
  politica_unicidad: 'libre',
  anonimato: false,
  requiere_datos_contacto: false,
  preguntas: [],
};

export const SurveyEditor = ({ survey, onSave, onPublish, isSaving, isPublishing }: SurveyEditorProps) => {
  const [formValues, setFormValues] = useState<SurveyDraftPayload>(fallbackDraft);
  const [questions, setQuestions] = useState<LocalQuestion[]>(mapSurveyToLocal(survey));

  useEffect(() => {
    setFormValues({
      titulo: survey?.titulo ?? '',
      slug: survey?.slug ?? '',
      descripcion: survey?.descripcion ?? '',
      tipo: survey?.tipo ?? 'opinion',
      inicio_at: survey?.inicio_at ?? '',
      fin_at: survey?.fin_at ?? '',
      politica_unicidad: survey?.politica_unicidad ?? 'libre',
      anonimato: survey?.anonimato ?? false,
      requiere_datos_contacto: !(survey?.anonimato ?? false),
      preguntas: survey?.preguntas?.map((pregunta, index) => ({
        id: pregunta.id,
        orden: index + 1,
        tipo: pregunta.tipo,
        texto: pregunta.texto,
        obligatoria: pregunta.obligatoria,
        min_selecciones: pregunta.min_selecciones ?? null,
        max_selecciones: pregunta.max_selecciones ?? null,
        opciones: pregunta.opciones?.map((opcion, optIndex) => ({
          id: opcion.id,
          orden: optIndex + 1,
          texto: opcion.texto,
          valor: opcion.valor,
        })),
      })) ?? [],
    });
    setQuestions((prev) => {
      const next = mapSurveyToLocal(survey);
      return next.length ? next : prev.length ? prev : [createLocalQuestion(1)];
    });
  }, [survey]);

  useEffect(() => {
    if (!questions.length) {
      setQuestions([createLocalQuestion(1)]);
    }
  }, [questions.length]);

  const handleQuestionChange = (localId: string, partial: Partial<LocalQuestion>) => {
    setQuestions((prev) =>
      prev.map((question) => (question.localId === localId ? { ...question, ...partial } : question)),
    );
  };

  const handleOptionChange = (questionId: string, optionId: string, partial: Partial<LocalOption>) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.localId !== questionId) return question;
        return {
          ...question,
          opciones: (question.opciones ?? []).map((option) =>
            option.localId === optionId ? { ...option, ...partial } : option,
          ),
        };
      }),
    );
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, createLocalQuestion(prev.length + 1)]);
  };

  const handleRemoveQuestion = (localId: string) => {
    setQuestions((prev) => prev.filter((question) => question.localId !== localId));
  };

  const handleAddOption = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.localId !== questionId) return question;
        const next = [...(question.opciones ?? []), createLocalOption((question.opciones?.length ?? 0) + 1)];
        return { ...question, opciones: next };
      }),
    );
  };

  const handleRemoveOption = (questionId: string, optionId: string) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.localId !== questionId) return question;
        return { ...question, opciones: (question.opciones ?? []).filter((option) => option.localId !== optionId) };
      }),
    );
  };

  const preparedPayload = useMemo<SurveyDraftPayload>(() => ({
    ...formValues,
    preguntas: questions.map((question, index) => ({
      id: question.id,
      orden: index + 1,
      tipo: question.tipo,
      texto: question.texto.trim(),
      obligatoria: question.obligatoria,
      min_selecciones: question.tipo === 'multiple' ? question.min_selecciones ?? null : null,
      max_selecciones: question.tipo === 'multiple' ? question.max_selecciones ?? null : null,
      opciones:
        question.tipo === 'abierta'
          ? undefined
          : (question.opciones ?? []).map((option, optIndex) => ({
              id: option.id,
              orden: optIndex + 1,
              texto: option.texto,
              valor: option.valor,
            })),
    })),
  }), [formValues, questions]);

  const handleSave = async () => {
    if (!formValues.titulo.trim()) {
      toast({ title: 'El título es obligatorio', variant: 'destructive' });
      return;
    }
    if (!preparedPayload.preguntas.length) {
      toast({ title: 'Agregá al menos una pregunta', variant: 'destructive' });
      return;
    }
    try {
      await onSave(preparedPayload);
      toast({ title: 'Encuesta guardada', description: 'Los cambios se guardaron correctamente.' });
    } catch (error) {
      toast({ title: 'Error al guardar', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const handlePublish = async () => {
    if (!onPublish) return;
    try {
      await onPublish();
      toast({ title: 'Encuesta publicada', description: 'Compartí el enlace y el código QR con tu comunidad.' });
    } catch (error) {
      toast({ title: 'No se pudo publicar', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    }
  };

  const publicUrl = useMemo(
    () => getAbsolutePublicSurveyUrl(survey?.slug ?? ''),
    [survey?.slug],
  );

  const qrUrl = survey?.slug ? `/api/public/encuestas/${survey.slug}/qr?size=512` : '';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración general</CardTitle>
          <CardDescription>Definí los datos principales de la encuesta y su política de participación.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="survey-title">Título</Label>
            <Input
              id="survey-title"
              value={formValues.titulo}
              onChange={(event) => setFormValues((prev) => ({ ...prev, titulo: event.target.value }))}
              placeholder="Título visible para las personas participantes"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="survey-slug">Slug público</Label>
            <Input
              id="survey-slug"
              value={formValues.slug ?? ''}
              onChange={(event) => setFormValues((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="Identificador en la URL (ej. plan-ambiental)"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="survey-description">Descripción</Label>
            <Textarea
              id="survey-description"
              value={formValues.descripcion ?? ''}
              onChange={(event) => setFormValues((prev) => ({ ...prev, descripcion: event.target.value }))}
              placeholder="Contá brevemente el objetivo de la encuesta"
              className="min-h-[120px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={formValues.tipo}
              onValueChange={(value: SurveyTipo) => setFormValues((prev) => ({ ...prev, tipo: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná un tipo" />
              </SelectTrigger>
              <SelectContent>
                {tipoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Política de unicidad</Label>
            <Select
              value={formValues.politica_unicidad}
              onValueChange={(value: SurveyDraftPayload['politica_unicidad']) =>
                setFormValues((prev) => ({ ...prev, politica_unicidad: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná una opción" />
              </SelectTrigger>
              <SelectContent>
                {unicidadOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inicio-at">Inicio</Label>
            <Input
              id="inicio-at"
              type="datetime-local"
              value={formValues.inicio_at?.slice(0, 16) ?? ''}
              onChange={(event) => setFormValues((prev) => ({ ...prev, inicio_at: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fin-at">Fin</Label>
            <Input
              id="fin-at"
              type="datetime-local"
              value={formValues.fin_at?.slice(0, 16) ?? ''}
              onChange={(event) => setFormValues((prev) => ({ ...prev, fin_at: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center justify-between">Anonimato</Label>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Encuesta anónima</p>
                <p className="text-xs text-muted-foreground">No se solicitarán datos personales.</p>
              </div>
              <Switch
                checked={formValues.anonimato}
                onCheckedChange={(checked) =>
                  setFormValues((prev) => ({ ...prev, anonimato: checked, requiere_datos_contacto: !checked }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center justify-between">Control de duplicados</Label>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Solicitar datos de contacto</p>
                <p className="text-xs text-muted-foreground">Usá DNI o teléfono para validar respuestas.</p>
              </div>
              <Switch
                checked={formValues.requiere_datos_contacto}
                onCheckedChange={(checked) => setFormValues((prev) => ({ ...prev, requiere_datos_contacto: checked }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preguntas</CardTitle>
          <CardDescription>Arrastrá para reordenar, editá las opciones y definí validaciones.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Reorder.Group axis="y" values={questions} onReorder={setQuestions} className="space-y-4">
            {questions.map((question) => (
              <Reorder.Item
                key={question.localId}
                value={question}
                className="border border-border rounded-lg bg-card/60 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={question.texto}
                        onChange={(event) => handleQuestionChange(question.localId, { texto: event.target.value })}
                        placeholder="Enunciado de la pregunta"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Tipo de pregunta</Label>
                        <Select
                          value={question.tipo}
                          onValueChange={(value: PreguntaTipo) => {
                            handleQuestionChange(question.localId, {
                              tipo: value,
                              opciones:
                                value === 'abierta'
                                  ? []
                                  : question.opciones?.length
                                    ? question.opciones
                                    : [createLocalOption(1), createLocalOption(2)],
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccioná un tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {preguntaTipoOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Obligatoria</Label>
                        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                          <span className="text-sm text-muted-foreground">Requerir respuesta</span>
                          <Switch
                            checked={question.obligatoria}
                            onCheckedChange={(checked) => handleQuestionChange(question.localId, { obligatoria: checked })}
                          />
                        </div>
                      </div>
                      {question.tipo === 'multiple' && (
                        <>
                          <div className="space-y-2">
                            <Label>Mínimo de selecciones</Label>
                            <Input
                              type="number"
                              min={0}
                              value={question.min_selecciones ?? 0}
                              onChange={(event) =>
                                handleQuestionChange(question.localId, {
                                  min_selecciones: Number(event.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Máximo de selecciones</Label>
                            <Input
                              type="number"
                              min={0}
                              value={question.max_selecciones ?? 0}
                              onChange={(event) =>
                                handleQuestionChange(question.localId, {
                                  max_selecciones: Number(event.target.value),
                                })
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>
                    {question.tipo !== 'abierta' && (
                      <div className="space-y-2">
                        <Label>Opciones</Label>
                        <div className="flex flex-col gap-2">
                          {(question.opciones ?? []).map((option) => (
                            <div key={option.localId} className="flex items-center gap-2">
                              <Input
                                value={option.texto}
                                onChange={(event) =>
                                  handleOptionChange(question.localId, option.localId, { texto: event.target.value })
                                }
                                placeholder="Texto visible"
                              />
                              <Input
                                value={option.valor ?? ''}
                                onChange={(event) =>
                                  handleOptionChange(question.localId, option.localId, { valor: event.target.value })
                                }
                                placeholder="Valor interno (opcional)"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveOption(question.localId, option.localId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="inline-flex items-center gap-2 self-start"
                            onClick={() => handleAddOption(question.localId)}
                          >
                            <Plus className="h-4 w-4" /> Agregar opción
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveQuestion(question.localId)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
          <Button type="button" variant="outline" onClick={handleAddQuestion} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Agregar pregunta
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleSave} disabled={isSaving} className="inline-flex items-center gap-2">
          <UploadCloud className="h-4 w-4" /> {isSaving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {onPublish && (
          <Button type="button" variant="secondary" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? 'Publicando…' : 'Publicar'}
          </Button>
        )}
      </div>

      {survey?.estado === 'publicada' && (
        <Card>
          <CardHeader>
            <CardTitle>Compartir encuesta</CardTitle>
            <CardDescription>Distribuí el enlace y el QR para sumar participación ciudadana.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Vigente hasta {new Date(survey.fin_at).toLocaleString()}
              </p>
              {publicUrl && (
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-3 py-1 text-sm">{publicUrl}</code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(publicUrl);
                        toast({ title: 'Link copiado' });
                      } catch (error) {
                        toast({
                          title: 'No se pudo copiar',
                          description: String((error as Error)?.message ?? error),
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {qrUrl && (
              <img src={qrUrl} alt="Código QR de la encuesta" className="h-48 w-48 rounded-md border border-border" />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
