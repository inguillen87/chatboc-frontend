import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { PublicResponsePayload, SurveyPublic, SurveyPregunta } from '@/types/encuestas';

interface SurveyFormProps {
  survey: SurveyPublic;
  onSubmit: (payload: PublicResponsePayload) => Promise<void>;
  loading?: boolean;
  defaultMetadata?: Pick<PublicResponsePayload, 'utm_campaign' | 'utm_source' | 'canal'>;
}

interface AnswerState {
  opcionIds: number[];
  texto?: string;
}

export const SurveyForm = ({ survey, onSubmit, loading, defaultMetadata }: SurveyFormProps) => {
  const initialState = useMemo(() => {
    const state: Record<number, AnswerState> = {};
    survey.preguntas.forEach((pregunta) => {
      state[pregunta.id] = { opcionIds: [], texto: '' };
    });
    return state;
  }, [survey.preguntas]);

  const [answers, setAnswers] = useState<Record<number, AnswerState>>(initialState);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);

  const requireDni = survey.politica_unicidad === 'por_dni';
  const requirePhone = survey.politica_unicidad === 'por_phone';

  useEffect(() => {
    setAnswers(initialState);
    setErrors({});
    setIdentityError(null);
  }, [initialState]);

  useEffect(() => {
    setIdentityError(null);
    if (!requireDni) {
      setDni('');
    }
    if (!requirePhone) {
      setPhone('');
    }
  }, [requireDni, requirePhone]);

  const handleRadioChange = (pregunta: SurveyPregunta, value: string) => {
    const optionId = Number(value);
    setAnswers((prev) => ({
      ...prev,
      [pregunta.id]: { ...prev[pregunta.id], opcionIds: Number.isNaN(optionId) ? [] : [optionId] },
    }));
  };

  const handleCheckboxToggle = (pregunta: SurveyPregunta, optionId: number, checked: boolean) => {
    setAnswers((prev) => {
      const current = prev[pregunta.id] ?? { opcionIds: [] };
      const nextIds = checked
        ? Array.from(new Set([...(current.opcionIds ?? []), optionId]))
        : (current.opcionIds ?? []).filter((id) => id !== optionId);
      return { ...prev, [pregunta.id]: { ...current, opcionIds: nextIds } };
    });
  };

  const handleTextChange = (pregunta: SurveyPregunta, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [pregunta.id]: { ...prev[pregunta.id], texto: value },
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<number, string> = {};
    let newIdentityError: string | null = null;

    survey.preguntas.forEach((pregunta) => {
      const answer = answers[pregunta.id] ?? { opcionIds: [], texto: '' };
      if (pregunta.tipo === 'abierta') {
        if (pregunta.obligatoria && !answer.texto?.trim()) {
          newErrors[pregunta.id] = 'Este campo es obligatorio.';
        }
        return;
      }

      if (pregunta.tipo === 'opcion_unica') {
        if (pregunta.obligatoria && (!answer.opcionIds || answer.opcionIds.length === 0)) {
          newErrors[pregunta.id] = 'Seleccioná una opción.';
        }
        return;
      }

      if (pregunta.tipo === 'multiple') {
        const selected = answer.opcionIds ?? [];
        const min = pregunta.min_selecciones ?? (pregunta.obligatoria ? 1 : 0);
        const max = pregunta.max_selecciones ?? selected.length;
        if (selected.length < min) {
          newErrors[pregunta.id] = `Seleccioná al menos ${min} opción(es).`;
        } else if (selected.length > max) {
          newErrors[pregunta.id] = `Seleccioná hasta ${max} opción(es).`;
        }
      }
    });

    if (requireDni && !dni.trim()) {
      newIdentityError = 'Ingresá tu DNI para validar tu participación.';
    } else if (requirePhone && !phone.trim()) {
      newIdentityError = 'Ingresá tu teléfono para validar tu participación.';
    }

    setErrors(newErrors);
    setIdentityError(newIdentityError);
    return Object.keys(newErrors).length === 0 && !newIdentityError;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload: PublicResponsePayload = {
        respuestas: survey.preguntas.map((pregunta) => {
          const answer = answers[pregunta.id] ?? { opcionIds: [], texto: '' };
          const base = { pregunta_id: pregunta.id } as PublicResponsePayload['respuestas'][number];
          if (pregunta.tipo === 'abierta') {
            base.texto_libre = answer.texto?.trim() || '';
          } else if (pregunta.tipo === 'multiple') {
            base.opcion_ids = answer.opcionIds ?? [];
          } else {
            base.opcion_ids = answer.opcionIds.slice(0, 1);
          }
          return base;
        }),
        dni: requireDni ? dni.trim() : undefined,
        phone: requirePhone ? phone.trim() : undefined,
        ...defaultMetadata,
      };
      await onSubmit(payload);
      setErrors({});
      setIdentityError(null);
      if (requireDni) {
        setDni('');
      }
      if (requirePhone) {
        setPhone('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">{survey.titulo}</CardTitle>
        {survey.descripcion && (
          <CardDescription className="max-w-3xl whitespace-pre-line text-base text-muted-foreground">
            {survey.descripcion}
          </CardDescription>
        )}
        <div className="text-sm text-muted-foreground flex flex-col gap-1">
          <span>
            Vigencia: {new Date(survey.inicio_at).toLocaleDateString()} –{' '}
            {new Date(survey.fin_at).toLocaleDateString()}
          </span>
          <span>Tipo: {survey.tipo}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {(requireDni || requirePhone) && (
          <div className="rounded-lg border border-border bg-card/40 p-4 space-y-2">
            <p className="text-sm font-medium">
              Validación de participación
            </p>
            <p className="text-xs text-muted-foreground">
              Esta encuesta requiere un dato de contacto para evitar respuestas duplicadas.
            </p>
            {requireDni && (
              <div className="space-y-2">
                <Label htmlFor="survey-dni">Documento</Label>
                <Input
                  id="survey-dni"
                  inputMode="numeric"
                  value={dni}
                  onChange={(event) => setDni(event.target.value)}
                  placeholder="Ingresá tu número de documento"
                />
              </div>
            )}
            {requirePhone && (
              <div className="space-y-2">
                <Label htmlFor="survey-phone">Teléfono</Label>
                <Input
                  id="survey-phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Ingresá tu número de teléfono"
                />
              </div>
            )}
            {identityError && <p className="text-sm text-destructive">{identityError}</p>}
          </div>
        )}
        {survey.preguntas.map((pregunta) => (
          <div key={pregunta.id} className="space-y-3 border border-border rounded-lg p-4 bg-card/40">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-medium">
                {pregunta.orden}. {pregunta.texto}
              </h3>
              <p className="text-sm text-muted-foreground">
                {pregunta.obligatoria ? 'Obligatoria' : 'Opcional'} · Tipo: {pregunta.tipo}
              </p>
            </div>
            {pregunta.tipo === 'opcion_unica' && (
              <RadioGroup
                value={(answers[pregunta.id]?.opcionIds?.[0] ?? '').toString()}
                onValueChange={(value) => handleRadioChange(pregunta, value)}
                className="space-y-2"
              >
                {pregunta.opciones?.map((opcion) => (
                  <Label
                    key={opcion.id}
                    htmlFor={`preg-${pregunta.id}-opc-${opcion.id}`}
                    className="flex items-center gap-3 rounded-md border border-border/70 bg-background px-3 py-2 transition hover:border-primary"
                  >
                    <RadioGroupItem id={`preg-${pregunta.id}-opc-${opcion.id}`} value={opcion.id.toString()} />
                    <span>{opcion.texto}</span>
                  </Label>
                ))}
              </RadioGroup>
            )}
            {pregunta.tipo === 'multiple' && (
              <div className="flex flex-col gap-2">
                {pregunta.opciones?.map((opcion) => {
                  const checked = answers[pregunta.id]?.opcionIds?.includes(opcion.id) ?? false;
                  return (
                    <Label
                      key={opcion.id}
                      htmlFor={`preg-${pregunta.id}-opc-${opcion.id}`}
                      className="flex items-center gap-3 rounded-md border border-border/70 bg-background px-3 py-2 transition hover:border-primary"
                    >
                      <Checkbox
                        id={`preg-${pregunta.id}-opc-${opcion.id}`}
                        checked={checked}
                        onCheckedChange={(state) =>
                          handleCheckboxToggle(pregunta, opcion.id, state === true)
                        }
                      />
                      <span>{opcion.texto}</span>
                    </Label>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  {pregunta.min_selecciones && `Mínimo ${pregunta.min_selecciones}. `}
                  {pregunta.max_selecciones && `Máximo ${pregunta.max_selecciones}.`}
                </p>
              </div>
            )}
            {pregunta.tipo === 'abierta' && (
              <Textarea
                value={answers[pregunta.id]?.texto ?? ''}
                onChange={(event) => handleTextChange(pregunta, event.target.value)}
                placeholder="Escribí tu respuesta"
                className="min-h-[120px]"
              />
            )}
            {errors[pregunta.id] && (
              <p className="text-sm text-destructive">{errors[pregunta.id]}</p>
            )}
          </div>
        ))}

        <Button type="button" disabled={loading || submitting} onClick={handleSubmit} className="w-full md:w-auto">
          {loading || submitting ? 'Enviando…' : 'Enviar opinión'}
        </Button>
      </CardContent>
    </Card>
  );
};
