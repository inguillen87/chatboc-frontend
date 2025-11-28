import { useEffect, useMemo, useState } from 'react';
import { Award } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  type PublicResponsePayload,
  type SurveyAnalyticsMetadata,
  type SurveyDemographicMetadata,
  type SurveyLocationMetadata,
  type SurveyPublic,
  type SurveyPregunta,
} from '@/types/encuestas';
import { requestLocation, type PositionCoords } from '@/utils/geolocation';
import {
  AGE_RANGE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
} from '@/components/surveys/demographicOptions';

interface SurveyFormProps {
  survey: SurveyPublic;
  onSubmit: (payload: PublicResponsePayload) => Promise<void>;
  loading?: boolean;
  defaultMetadata?: Pick<PublicResponsePayload, 'utm_campaign' | 'utm_source' | 'canal'>;
  submitErrorMessage?: string | null;
  submitErrorStatus?: number | null;
  duplicateDetected?: boolean;
}

interface AnswerState {
  opcionIds: number[];
  texto?: string;
}

export const SurveyForm = ({
  survey,
  onSubmit,
  loading,
  defaultMetadata,
  submitErrorMessage,
  submitErrorStatus,
  duplicateDetected,
}: SurveyFormProps) => {
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
  const [demographics, setDemographics] = useState<SurveyDemographicMetadata>({});
  const [customGender, setCustomGender] = useState('');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [submissionErrorTitle, setSubmissionErrorTitle] = useState<string | null>(null);
  const [submissionErrorDetails, setSubmissionErrorDetails] = useState<string | null>(null);
  const [dismissedErrorKey, setDismissedErrorKey] = useState<string | null>(null);
  const currentErrorKey = useMemo(
    () => (submitErrorMessage ? `${submitErrorStatus ?? 'na'}::${submitErrorMessage}` : null),
    [submitErrorMessage, submitErrorStatus],
  );

  type LocationStringField = 'pais' | 'provincia' | 'ciudad' | 'barrio' | 'codigoPostal';

  const requireDni = survey.politica_unicidad === 'por_dni';
  const requirePhone = survey.politica_unicidad === 'por_phone';
  const contactRequired = Boolean(survey.requiere_datos_contacto);
  const showDniField = requireDni || contactRequired;
  const showPhoneField = requirePhone || contactRequired;
  const showContactBlock = showDniField || showPhoneField;

  useEffect(() => {
    setAnswers(initialState);
    setErrors({});
    setIdentityError(null);
    setDemographics({});
    setCustomGender('');
    setGeoStatus('idle');
    setGeoMessage(null);
  }, [initialState]);

  useEffect(() => {
    setIdentityError(null);
    if (!showDniField) {
      setDni('');
    }
    if (!showPhoneField) {
      setPhone('');
    }
  }, [showDniField, showPhoneField]);

  useEffect(() => {
    if (!submitErrorMessage || !currentErrorKey) {
      if (!submitting) {
        setSubmissionErrorTitle(null);
        setSubmissionErrorDetails(null);
      }
      return;
    }

    if (dismissedErrorKey && currentErrorKey === dismissedErrorKey) {
      return;
    }

    const normalized = submitErrorMessage.toLowerCase();
    const baseTitle =
      duplicateDetected || submitErrorStatus === 409
        ? 'Ya registramos tu opinión'
        : 'No pudimos enviar tu respuesta';

    let extraHint: string | null = null;
    if (duplicateDetected || submitErrorStatus === 409) {
      extraHint = 'La política de unicidad impide enviar más de una respuesta.';
    } else if (normalized.includes('cors') || normalized.includes('conexión')) {
      extraHint =
        'Revisá tu conexión o intentá nuevamente. Si el error persiste, compartí este mensaje con el equipo de soporte.';
    }

    const detail = extraHint ? `${submitErrorMessage} ${extraHint}` : submitErrorMessage;
    setSubmissionErrorTitle(baseTitle);
    setSubmissionErrorDetails(detail.trim());
  }, [
    submitErrorMessage,
    submitErrorStatus,
    duplicateDetected,
    submitting,
    currentErrorKey,
    dismissedErrorKey,
  ]);

  const normalizeString = (value?: string | null): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  const hasLocationData = (location?: SurveyLocationMetadata | null): boolean => {
    if (!location) return false;
    return (
      Boolean(normalizeString(location.pais)) ||
      Boolean(normalizeString(location.provincia)) ||
      Boolean(normalizeString(location.ciudad)) ||
      Boolean(normalizeString(location.barrio)) ||
      Boolean(normalizeString(location.codigoPostal)) ||
      (typeof location.lat === 'number' && Number.isFinite(location.lat)) ||
      (typeof location.lng === 'number' && Number.isFinite(location.lng))
    );
  };

  const handleDemographicsChange = (
    field: keyof SurveyDemographicMetadata,
    rawValue?: string | null,
  ) => {
    const nextValue = normalizeString(rawValue ?? undefined);
    setDemographics((prev) => {
      const next: SurveyDemographicMetadata = { ...prev };
      if (nextValue) {
        (next as Record<string, unknown>)[field as string] = nextValue;
      } else {
        delete (next as Record<string, unknown>)[field as string];
      }

      if (field === 'genero' && nextValue !== 'self-described') {
        delete (next as Record<string, unknown>)['generoDescripcion'];
      }

      return next;
    });

    if (field === 'genero' && rawValue !== 'self-described') {
      setCustomGender('');
    }
  };

  const handleLocationFieldChange = (field: LocationStringField, rawValue: string) => {
    const normalized = normalizeString(rawValue);
    let hasData = false;

    setDemographics((prev) => {
      const currentLocation = prev.ubicacion ?? {};
      const nextLocation: SurveyLocationMetadata = { ...currentLocation };

      if (normalized) {
        nextLocation[field] = normalized;
        if (field !== 'codigoPostal' && nextLocation.precision !== 'gps') {
          nextLocation.precision = 'manual';
          nextLocation.origen = 'usuario';
        }
      } else {
        delete (nextLocation as Record<string, unknown>)[field as string];
        if (!hasLocationData(nextLocation)) {
          delete (nextLocation as Record<string, unknown>).precision;
          delete (nextLocation as Record<string, unknown>).origen;
        }
      }

      hasData = hasLocationData(nextLocation);

      return {
        ...prev,
        ubicacion: hasData ? nextLocation : undefined,
      };
    });

    if (hasData) {
      setGeoStatus((status) => (status === 'loading' ? status : 'success'));
      setGeoMessage('Registramos la ubicación que ingresaste manualmente.');
    } else {
      setGeoStatus((status) => (status === 'loading' ? status : 'idle'));
      setGeoMessage(null);
    }
  };

  const handleRequestLocation = async () => {
    setGeoStatus('loading');
    setGeoMessage('Solicitando tu ubicación para las métricas territoriales…');

    try {
      const coords: PositionCoords | null = await requestLocation({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60_000,
      });

      if (!coords) {
        setGeoStatus('error');
        setGeoMessage('No pudimos obtener tu ubicación automáticamente. Podés ingresarla manualmente.');
        return;
      }

      setGeoStatus('success');
      setGeoMessage('Registramos tu ubicación GPS para mapas de calor y distribución barrial.');
      setDemographics((prev) => ({
        ...prev,
        ubicacion: {
          ...(prev.ubicacion ?? {}),
          lat: coords.latitud,
          lng: coords.longitud,
          precision: 'gps',
          origen: 'gps',
        },
      }));
    } catch (error) {
      console.warn('[SurveyForm] No pudimos obtener la ubicación del dispositivo', error);
      setGeoStatus('error');
      setGeoMessage('No pudimos obtener tu ubicación automáticamente. Podés ingresarla manualmente.');
    }
  };

  const sanitizeDemographics = (): SurveyDemographicMetadata | undefined => {
    const sanitized: SurveyDemographicMetadata = {};

    const genero = normalizeString(demographics.genero);
    if (genero) {
      sanitized.genero = genero;
      if (genero === 'self-described') {
        const generoDescripcion = normalizeString(demographics.generoDescripcion ?? customGender);
        if (generoDescripcion) {
          sanitized.generoDescripcion = generoDescripcion;
        }
      }
    }

    const rangoEtario = normalizeString(demographics.rangoEtario);
    if (rangoEtario) {
      sanitized.rangoEtario = rangoEtario;
    }

    const nivelEducativo = normalizeString(demographics.nivelEducativo);
    if (nivelEducativo) {
      sanitized.nivelEducativo = nivelEducativo;
    }

    const situacionLaboral = normalizeString(demographics.situacionLaboral);
    if (situacionLaboral) {
      sanitized.situacionLaboral = situacionLaboral;
    }

    const ocupacion = normalizeString(demographics.ocupacion);
    if (ocupacion) {
      sanitized.ocupacion = ocupacion;
    }

    const tiempoResidencia = normalizeString(demographics.tiempoResidencia);
    if (tiempoResidencia) {
      sanitized.tiempoResidencia = tiempoResidencia;
    }

    const location = demographics.ubicacion;
    if (location) {
      const sanitizedLocation: SurveyLocationMetadata = {};
      const pais = normalizeString(location.pais);
      if (pais) sanitizedLocation.pais = pais;
      const provincia = normalizeString(location.provincia);
      if (provincia) sanitizedLocation.provincia = provincia;
      const ciudad = normalizeString(location.ciudad);
      if (ciudad) sanitizedLocation.ciudad = ciudad;
      const barrio = normalizeString(location.barrio);
      if (barrio) sanitizedLocation.barrio = barrio;
      const codigoPostal = normalizeString(location.codigoPostal);
      if (codigoPostal) sanitizedLocation.codigoPostal = codigoPostal;
      if (typeof location.lat === 'number' && Number.isFinite(location.lat)) {
        sanitizedLocation.lat = Number(location.lat);
      }
      if (typeof location.lng === 'number' && Number.isFinite(location.lng)) {
        sanitizedLocation.lng = Number(location.lng);
      }
      if (location.precision) {
        sanitizedLocation.precision = location.precision;
      }
      if (location.origen) {
        sanitizedLocation.origen = location.origen;
      }

      if (hasLocationData(sanitizedLocation)) {
        sanitized.ubicacion = sanitizedLocation;
      }
    }

    return Object.keys(sanitized).length ? sanitized : undefined;
  };

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

    const trimmedDni = dni.trim();
    const trimmedPhone = phone.trim();
    const normalizedDni = trimmedDni.replace(/\D+/g, '');
    const normalizedPhone = trimmedPhone.replace(/\D+/g, '');

    if (requireDni && !normalizedDni) {
      newIdentityError = 'Ingresá tu DNI para validar tu participación.';
    } else if (requirePhone && !normalizedPhone) {
      newIdentityError = 'Ingresá tu teléfono para validar tu participación.';
    } else if (contactRequired && !normalizedDni && !normalizedPhone) {
      newIdentityError = 'Ingresá tu DNI o teléfono para validar tu participación.';
    }

    setErrors(newErrors);
    setIdentityError(newIdentityError);
    return Object.keys(newErrors).length === 0 && !newIdentityError;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!validate()) return;

    setSubmissionErrorTitle(null);
    setSubmissionErrorDetails(null);
    setDismissedErrorKey(null);
    setSubmitting(true);
    try {
      const sanitizedDemographics = sanitizeDemographics();
      const answeredQuestions = survey.preguntas.reduce((count, pregunta) => {
        const answer = answers[pregunta.id] ?? { opcionIds: [], texto: '' };
        if (pregunta.tipo === 'abierta') {
          return answer.texto?.trim() ? count + 1 : count;
        }
        const selected = answer.opcionIds ?? [];
        return selected.length > 0 ? count + 1 : count;
      }, 0);

      const metadataPayload: SurveyAnalyticsMetadata = {
        answeredQuestions,
        totalQuestions: survey.preguntas.length,
        submittedAt: new Date().toISOString(),
      };

      if (defaultMetadata?.canal) {
        metadataPayload.canal = defaultMetadata.canal;
      }

      if (sanitizedDemographics) {
        metadataPayload.demographics = sanitizedDemographics;
      }

      const trimmedDni = dni.trim();
      const trimmedPhone = phone.trim();
      const normalizedDni = trimmedDni.replace(/\D+/g, '');
      const normalizedPhone = trimmedPhone.replace(/\D+/g, '');

      const respuestas = survey.preguntas.reduce<PublicResponsePayload['respuestas']>((acc, pregunta) => {
        const answer = answers[pregunta.id] ?? { opcionIds: [], texto: '' };
        const base = { pregunta_id: pregunta.id } as PublicResponsePayload['respuestas'][number];

        if (pregunta.tipo === 'abierta') {
          const textoLibre = answer.texto?.trim();

          if (!textoLibre) {
            if (pregunta.obligatoria) {
              base.texto_libre = '';
              acc.push(base);
            }
            return acc;
          }

          base.texto_libre = textoLibre;
          acc.push(base);
          return acc;
        }

        const selectedIds = Array.isArray(answer.opcionIds)
          ? Array.from(new Set(answer.opcionIds.filter((id) => typeof id === 'number')))
          : [];

        if (!selectedIds.length) {
          if (pregunta.obligatoria) {
            base.opcion_ids = [];
            acc.push(base);
          }
          return acc;
        }

        base.opcion_ids = pregunta.tipo === 'multiple' ? selectedIds : selectedIds.slice(0, 1);
        acc.push(base);
        return acc;
      }, []);

      if (!respuestas.length) {
        setSubmitting(false);
        setSubmissionErrorTitle('No pudimos enviar tu respuesta');
        setSubmissionErrorDetails('Seleccioná al menos una opción o completá una respuesta antes de enviar.');
        return;
      }

      metadataPayload.answeredQuestions = respuestas.length;

      const payload: PublicResponsePayload = {
        respuestas,
        dni: normalizedDni ? normalizedDni : undefined,
        phone: normalizedPhone ? normalizedPhone : undefined,
        ...defaultMetadata,
        metadata: metadataPayload,
      };
      await onSubmit(payload);
      setErrors({});
      setIdentityError(null);
      if (showDniField) {
        setDni('');
      }
      if (showPhoneField) {
        setPhone('');
      }
      setDemographics({});
      setCustomGender('');
      setGeoStatus('idle');
      setGeoMessage(null);
      setAnswers(initialState);
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
      <CardContent className="space-y-10">
        {survey.puntos_recompensa && survey.puntos_recompensa > 0 && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
            <Award className="h-4 w-4" />
            ¡Ganá {survey.puntos_recompensa} puntos completando esta encuesta!
          </div>
        )}
        {submissionErrorTitle && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 text-left">
            <div className="flex flex-col gap-3">
              <div>
                <AlertTitle>{submissionErrorTitle}</AlertTitle>
                {submissionErrorDetails && (
                  <AlertDescription>
                    <p>{submissionErrorDetails}</p>
                    {submitErrorStatus && submitErrorStatus >= 500 && (
                      <p className="mt-2 text-xs text-destructive/80">
                        El servidor devolvió un error inesperado. Intentá nuevamente en unos minutos o compartí este mensaje con
                        soporte.
                      </p>
                    )}
                  </AlertDescription>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSubmissionErrorTitle(null);
                    setSubmissionErrorDetails(null);
                    setDismissedErrorKey(currentErrorKey);
                  }}
                >
                  Entendido
                </Button>
              </div>
            </div>
          </Alert>
        )}
        {showContactBlock && (
          <div className="rounded-lg border border-border bg-card/40 p-4 space-y-2">
            <p className="text-sm font-medium">
              Validación de participación
            </p>
            <p className="text-xs text-muted-foreground">
              {requireDni
                ? 'Ingresá tu número de documento para validar tu participación.'
                : requirePhone
                  ? 'Ingresá tu número de teléfono para validar tu participación.'
                  : 'Ingresá tu número de documento o teléfono para validar tu participación.'}
            </p>
            {showDniField && (
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
            {showPhoneField && (
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
        <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Datos demográficos y territoriales (opcional)</p>
            <p className="text-xs text-muted-foreground">
              Esta información complementaria permite construir métricas segmentadas, mapas de calor y tableros en tiempo real.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-age-range">Rango etario</Label>
              <Select
                value={demographics.rangoEtario}
                onValueChange={(value) => handleDemographicsChange('rangoEtario', value)}
              >
                <SelectTrigger id="survey-age-range">
                  <SelectValue placeholder="Seleccioná tu rango etario" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-gender">Sexo / género</Label>
              <Select
                value={demographics.genero}
                onValueChange={(value) => handleDemographicsChange('genero', value)}
              >
                <SelectTrigger id="survey-gender">
                  <SelectValue placeholder="Seleccioná una opción" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {demographics.genero === 'self-described' ? (
            <div className="space-y-2">
              <Label htmlFor="survey-gender-detail">Autodescripción</Label>
              <Input
                id="survey-gender-detail"
                value={customGender}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomGender(value);
                  handleDemographicsChange('generoDescripcion', value);
                }}
                placeholder="Ingresá cómo te identificás"
              />
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-education">Nivel educativo</Label>
              <Select
                value={demographics.nivelEducativo}
                onValueChange={(value) => handleDemographicsChange('nivelEducativo', value)}
              >
                <SelectTrigger id="survey-education">
                  <SelectValue placeholder="Seleccioná una opción" />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-employment">Situación laboral</Label>
              <Select
                value={demographics.situacionLaboral}
                onValueChange={(value) => handleDemographicsChange('situacionLaboral', value)}
              >
                <SelectTrigger id="survey-employment">
                  <SelectValue placeholder="Seleccioná una opción" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="survey-occupation">Ocupación / rubro (opcional)</Label>
            <Input
              id="survey-occupation"
              value={demographics.ocupacion ?? ''}
              onChange={(event) => handleDemographicsChange('ocupacion', event.target.value)}
              placeholder="Ej: Comercio minorista, educación, salud"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-country">País o región</Label>
              <Input
                id="survey-country"
                value={demographics.ubicacion?.pais ?? ''}
                onChange={(event) => handleLocationFieldChange('pais', event.target.value)}
                placeholder="Ej: Argentina"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-province">Provincia / estado</Label>
              <Input
                id="survey-province"
                value={demographics.ubicacion?.provincia ?? ''}
                onChange={(event) => handleLocationFieldChange('provincia', event.target.value)}
                placeholder="Ej: Santa Fe"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-city">Ciudad o localidad</Label>
              <Input
                id="survey-city"
                value={demographics.ubicacion?.ciudad ?? ''}
                onChange={(event) => handleLocationFieldChange('ciudad', event.target.value)}
                placeholder="Ej: Rosario"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-neighborhood">Barrio o zona</Label>
              <Input
                id="survey-neighborhood"
                value={demographics.ubicacion?.barrio ?? ''}
                onChange={(event) => handleLocationFieldChange('barrio', event.target.value)}
                placeholder="Ej: Barrio Centro"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-postal-code">Código postal</Label>
              <Input
                id="survey-postal-code"
                value={demographics.ubicacion?.codigoPostal ?? ''}
                onChange={(event) => handleLocationFieldChange('codigoPostal', event.target.value)}
                placeholder="Ej: 2000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-residency">Tiempo de residencia en la zona</Label>
              <Input
                id="survey-residency"
                value={demographics.tiempoResidencia ?? ''}
                onChange={(event) => handleDemographicsChange('tiempoResidencia', event.target.value)}
                placeholder="Ej: 5 años"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-muted-foreground">
              Podés compartir tu ubicación para fortalecer las métricas territoriales y la segmentación por barrios.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleRequestLocation}
              disabled={geoStatus === 'loading'}
            >
              {geoStatus === 'loading' ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
            </Button>
          </div>
          {geoMessage ? (
            <p className={`text-xs ${geoStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {geoMessage}
            </p>
          ) : null}
          {typeof demographics.ubicacion?.lat === 'number' && typeof demographics.ubicacion?.lng === 'number' ? (
            <p className="text-xs text-muted-foreground">
              Coordenadas registradas: {demographics.ubicacion.lat.toFixed(4)}, {demographics.ubicacion.lng.toFixed(4)}
            </p>
          ) : null}
        </div>
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
