import React, { useEffect, useMemo, useState } from 'react';
import type { SaasAction } from '@/api/v2/saas';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export type TicketShareActionKind = 'location' | 'form' | 'attachment';
export type TicketShareActionPayload = Record<string, unknown> & {
  lat?: number;
  lng?: number;
  label?: string;
  address?: string;
  capture_source?: 'manual' | 'operator_browser_geolocation';
  location?: Record<string, unknown>;
  form_id?: number;
  form_slug?: string;
  attachment_id?: number;
};

type PlainRecord = Record<string, unknown>;
type OptionValue = string | number;
type VerifiedOption = { value: OptionValue; label: string };
type FormField = 'form_slug' | 'form_id';
type FormInputConfig = { field: FormField; options: VerifiedOption[] };
type LocationRequirement = 'coordinates' | 'address' | 'either' | 'both';
type LocationInputConfig = {
  shape: 'root' | 'nested';
  requirement: LocationRequirement;
  allowsCoordinates: boolean;
  allowsAddress: boolean;
  allowsLabel: boolean;
  allowsCaptureSource: boolean;
  requiresLabel: boolean;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  labelMaxLength: number;
  addressMaxLength: number;
};
type ConfigResult<T> = { config: T | null; error: string | null };

interface TicketShareActionDialogProps {
  action: SaasAction | null;
  kind: TicketShareActionKind;
  open: boolean;
  replyContract?: PlainRecord;
  attachments?: unknown[];
  submitting?: boolean;
  errorMessage?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: TicketShareActionPayload) => void;
}

const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const FORM_OPTIONS_SOURCE = 'reply_contract.form_selection.options';
const META_FIELDS = new Set([
  IDEMPOTENCY_HEADER,
  'client_message_id',
  'idempotency_key',
  'source_model',
  'ticket_id',
  'legacy_id',
]);
const LOCATION_FIELDS = new Set(['location', 'lat', 'lng', 'address', 'label', 'capture_source']);

const asRecord = (value: unknown): PlainRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as PlainRecord : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const strings = (value: unknown): string[] => asArray(value).flatMap((candidate) => {
  if (typeof candidate !== 'string') return [];
  const normalized = candidate.trim();
  return normalized ? [normalized] : [];
});
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const finiteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const positiveId = (value: unknown): number | null => {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
const positiveInteger = (value: unknown, fallback: number): number => {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const isMissing = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && !value.trim());
const getActionDefaults = (action: SaasAction | null): PlainRecord => ({
  ...asRecord(action?.payload_defaults),
  ...asRecord(action?.payloadDefaults),
  ...asRecord(action?.payload),
});

const getAttachmentOptions = (attachments: unknown[] = []): VerifiedOption[] =>
  attachments.flatMap((candidate) => {
    const item = asRecord(candidate);
    const id = positiveId(item.id ?? item.attachment_id);
    const label = text(item.filename ?? item.file_name ?? item.name ?? item.nombre);
    return id && label ? [{ value: id, label }] : [];
  });

const getLegacyFormOptions = (action: SaasAction | null): VerifiedOption[] => {
  const raw = asRecord(action?.raw);
  return asArray(raw.options).flatMap((candidate) => {
    const item = asRecord(candidate);
    const id = positiveId(item.form_id ?? item.id);
    const label = text(item.label ?? item.name ?? item.title);
    const evidence = asRecord(item.evidence);
    const approved = item.approved === true && item.tenant_owned === true && item.tenant_verified === true &&
      evidence.approved === true && evidence.tenant_owned === true && evidence.flow_contract_verified === true;
    return id && label && approved ? [{ value: id, label }] : [];
  });
};

const optionKey = (value: OptionValue): string => `${typeof value}:${String(value)}`;
const dedupeOptions = (options: VerifiedOption[]): VerifiedOption[] => {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = optionKey(option.value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getPublishedFormOptions = (
  field: FormField,
  propertySchema: PlainRecord,
  replyContract?: PlainRecord,
): ConfigResult<VerifiedOption[]> => {
  const source = text(propertySchema['x-options-source']);
  if (source && source !== FORM_OPTIONS_SOURCE) {
    return { config: null, error: 'El esquema del formulario referencia una fuente de opciones no reconocida.' };
  }

  const enumValues = asArray(propertySchema.enum).flatMap<OptionValue>((value): OptionValue[] => {
    if (field === 'form_slug' && typeof value === 'string' && value.trim()) return [value.trim()];
    const id = field === 'form_id' ? positiveId(value) : null;
    return id ? [id] : [];
  });
  const enumKeys = new Set(enumValues.map(optionKey));
  const formSelection = asRecord(asRecord(replyContract).form_selection);
  const publishedOptions = asArray(formSelection.options).flatMap<VerifiedOption>((candidate): VerifiedOption[] => {
    const item = asRecord(candidate);
    const value = field === 'form_slug' ? text(item.form_slug) : positiveId(item.form_id ?? item.id);
    const label = text(item.label ?? item.name ?? item.title);
    if (value === null || !label) return [];
    if (enumKeys.size && !enumKeys.has(optionKey(value))) return [];
    return [{ value, label }];
  });
  if (source && !publishedOptions.length) {
    return { config: null, error: 'El backend no publicó opciones compatibles para seleccionar el formulario.' };
  }
  const options = publishedOptions.length
    ? publishedOptions
    : enumValues.map((value) => ({ value, label: String(value) }));
  if (!options.length) {
    return { config: null, error: 'El esquema no publicó una lista cerrada de formularios disponibles.' };
  }
  return { config: dedupeOptions(options), error: null };
};

const resolveFormInputConfig = (
  action: SaasAction | null,
  replyContract?: PlainRecord,
): ConfigResult<FormInputConfig> => {
  if (!action) return { config: null, error: 'Este ticket no publicó una acción de formulario.' };
  const schema = asRecord(action.input_schema);
  if (!Object.keys(schema).length) {
    const required = new Set(action.requires || []);
    if (!required.has('form_id') || required.has('form_slug')) {
      return { config: null, error: 'La acción no publicó un esquema inequívoco para identificar el formulario.' };
    }
    const options = getLegacyFormOptions(action);
    return options.length
      ? { config: { field: 'form_id', options }, error: null }
      : { config: null, error: 'El backend no publicó formularios reales, aprobados y pertenecientes al tenant para este ticket.' };
  }
  if (schema.type !== 'object') {
    return { config: null, error: 'El esquema de formulario publicado no es un objeto compatible.' };
  }
  const properties = asRecord(schema.properties);
  const candidates = (['form_slug', 'form_id'] as const)
    .filter((field) => Object.keys(asRecord(properties[field])).length > 0);
  if (candidates.length !== 1) {
    return { config: null, error: 'El esquema de formulario es ambiguo: debe publicar un único identificador.' };
  }
  const field = candidates[0];
  const propertySchema = asRecord(properties[field]);
  if (
    (field === 'form_slug' && propertySchema.type !== 'string') ||
    (field === 'form_id' && propertySchema.type !== 'integer' && propertySchema.type !== 'number')
  ) {
    return { config: null, error: `El esquema publicó ${field} con un tipo incompatible.` };
  }
  const schemaRequired = new Set(strings(schema.required));
  if (!schemaRequired.has(field)) {
    return { config: null, error: `El esquema no exige ${field}; la acción queda bloqueada para no inventar el payload.` };
  }
  const defaults = getActionDefaults(action);
  const unsupportedRequired = [...schemaRequired].filter(
    (requiredField) => requiredField !== field && !META_FIELDS.has(requiredField) && isMissing(defaults[requiredField]),
  );
  if (unsupportedRequired.length) {
    return { config: null, error: `El esquema exige campos que esta consola no puede completar: ${unsupportedRequired.join(', ')}.` };
  }
  const actionFormFields = (action.requires || [])
    .filter((requiredField) => requiredField === 'form_slug' || requiredField === 'form_id');
  if (actionFormFields.some((requiredField) => requiredField !== field)) {
    return { config: null, error: 'El esquema y los campos requeridos se contradicen sobre el identificador del formulario.' };
  }
  const unsupportedActionRequired = (action.requires || []).filter(
    (requiredField) => requiredField !== field && !META_FIELDS.has(requiredField) && isMissing(defaults[requiredField]),
  );
  if (unsupportedActionRequired.length) {
    return { config: null, error: `La acción exige campos que esta consola no puede completar: ${unsupportedActionRequired.join(', ')}.` };
  }
  const optionsResult = getPublishedFormOptions(field, propertySchema, replyContract);
  return optionsResult.config
    ? { config: { field, options: optionsResult.config }, error: null }
    : { config: null, error: optionsResult.error };
};

const parseLocationRequirement = (
  schema: PlainRecord,
  requiredFields: Set<string>,
): ConfigResult<LocationRequirement> => {
  const alternatives = asArray(schema.anyOf);
  if (alternatives.length) {
    const alternativeKinds = alternatives.flatMap((candidate) => {
      const required = new Set(strings(asRecord(candidate).required));
      if (required.size === 1 && required.has('address')) return ['address' as const];
      if (required.size === 2 && required.has('lat') && required.has('lng')) return ['coordinates' as const];
      return [];
    });
    if (alternativeKinds.length !== alternatives.length) {
      return { config: null, error: 'El esquema de ubicación publicó alternativas que esta consola no reconoce.' };
    }
    const kinds = new Set(alternativeKinds);
    if (kinds.has('address') && kinds.has('coordinates')) return { config: 'either', error: null };
    if (kinds.has('coordinates')) return { config: 'coordinates', error: null };
    if (kinds.has('address')) return { config: 'address', error: null };
  }
  const requiresLat = requiredFields.has('lat');
  const requiresLng = requiredFields.has('lng');
  if (requiresLat !== requiresLng) {
    return { config: null, error: 'El esquema exige una coordenada incompleta; se requieren latitud y longitud juntas.' };
  }
  const requiresCoordinates = requiresLat && requiresLng;
  const requiresAddress = requiredFields.has('address');
  if (requiresCoordinates && requiresAddress) return { config: 'both', error: null };
  if (requiresCoordinates) return { config: 'coordinates', error: null };
  if (requiresAddress) return { config: 'address', error: null };
  return { config: 'either', error: null };
};

const resolveLocationInputConfig = (action: SaasAction | null): ConfigResult<LocationInputConfig> => {
  if (!action) return { config: null, error: 'Este ticket no publicó una acción de ubicación.' };
  const schema = asRecord(action.input_schema);
  const defaults = getActionDefaults(action);
  if (!Object.keys(schema).length) {
    const required = new Set(action.requires || []);
    const accepted = new Set([...required, ...strings(asRecord(action.raw).accepted_fields)]);
    if (!accepted.has('lat') || !accepted.has('lng')) {
      return { config: null, error: 'La acción no exige coordenadas WGS84 completas.' };
    }
    return {
      config: {
        shape: 'root',
        requirement: required.has('address') ? 'both' : 'coordinates',
        allowsCoordinates: true,
        allowsAddress: accepted.has('address'),
        allowsLabel: accepted.has('label'),
        allowsCaptureSource: accepted.has('capture_source'),
        requiresLabel: (action.requires || []).includes('label'),
        latMin: -90,
        latMax: 90,
        lngMin: -180,
        lngMax: 180,
        labelMaxLength: 100,
        addressMaxLength: 300,
      },
      error: null,
    };
  }
  if (schema.type !== 'object') {
    return { config: null, error: 'El esquema de ubicación publicado no es un objeto compatible.' };
  }

  const topProperties = asRecord(schema.properties);
  const nestedLocation = asRecord(topProperties.location);
  const hasNestedLocation = Object.keys(nestedLocation).length > 0;
  const hasRootLocationFields = [...LOCATION_FIELDS]
    .filter((field) => field !== 'location')
    .some((field) => Object.keys(asRecord(topProperties[field])).length > 0);
  if (hasNestedLocation && hasRootLocationFields) {
    return { config: null, error: 'El esquema mezcla ubicación anidada y campos raíz; la forma del payload es ambigua.' };
  }

  const shape: LocationInputConfig['shape'] = hasNestedLocation ? 'nested' : 'root';
  if (shape === 'nested' && nestedLocation.type !== 'object') {
    return { config: null, error: 'El campo location no publicó un objeto compatible.' };
  }
  const fieldSchema = shape === 'nested' ? nestedLocation : schema;
  const properties = shape === 'nested' ? asRecord(nestedLocation.properties) : topProperties;
  if (asArray(fieldSchema.oneOf).length || asArray(fieldSchema.allOf).length) {
    return { config: null, error: 'El esquema de ubicación usa una composición que esta consola no puede interpretar sin ambigüedad.' };
  }
  const topRequired = new Set(strings(schema.required));
  const fieldRequired = new Set(strings(fieldSchema.required));
  const actionRequired = new Set(action.requires || []);

  if (shape === 'nested') {
    if (!topRequired.has('location') && !actionRequired.has('location')) {
      return { config: null, error: 'El esquema anidado no exige el objeto location.' };
    }
    if ([...actionRequired].some((field) => ['lat', 'lng', 'address', 'label', 'capture_source'].includes(field))) {
      return { config: null, error: 'El esquema anidado contradice los campos raíz exigidos por la acción.' };
    }
  } else if (actionRequired.has('location')) {
    return { config: null, error: 'El esquema raíz contradice el objeto location exigido por la acción.' };
  }

  const unsupportedRequired = [
    ...(shape === 'nested' ? [...topRequired].filter((field) => field !== 'location') : [...fieldRequired]),
    ...(shape === 'nested' ? [...fieldRequired].filter((field) => !LOCATION_FIELDS.has(field)) : []),
    ...[...actionRequired].filter((field) => !LOCATION_FIELDS.has(field) && !META_FIELDS.has(field) && isMissing(defaults[field])),
  ].filter((field) => !META_FIELDS.has(field) && !LOCATION_FIELDS.has(field) && isMissing(defaults[field]));
  if (unsupportedRequired.length) {
    return { config: null, error: `El esquema exige campos de ubicación no compatibles: ${[...new Set(unsupportedRequired)].join(', ')}.` };
  }

  const latSchema = asRecord(properties.lat);
  const lngSchema = asRecord(properties.lng);
  const addressSchema = asRecord(properties.address);
  const labelSchema = asRecord(properties.label);
  const captureSourceSchema = asRecord(properties.capture_source);
  const hasLat = Object.keys(latSchema).length > 0;
  const hasLng = Object.keys(lngSchema).length > 0;
  if (hasLat !== hasLng) {
    return { config: null, error: 'El esquema publicó una coordenada incompleta; se requieren latitud y longitud juntas.' };
  }
  if ((hasLat && latSchema.type !== 'number') || (hasLng && lngSchema.type !== 'number')) {
    return { config: null, error: 'El esquema de coordenadas no publicó valores numéricos.' };
  }
  if (Object.keys(addressSchema).length && addressSchema.type !== 'string') {
    return { config: null, error: 'El esquema de dirección no publicó un texto compatible.' };
  }
  if (Object.keys(labelSchema).length && labelSchema.type !== 'string') {
    return { config: null, error: 'El esquema de etiqueta no publicó un texto compatible.' };
  }
  if (Object.keys(captureSourceSchema).length && captureSourceSchema.type !== 'string') {
    return { config: null, error: 'El esquema de procedencia de ubicación no publicó un texto compatible.' };
  }
  const captureSourceEnum = asArray(captureSourceSchema.enum);
  if (
    Object.prototype.hasOwnProperty.call(captureSourceSchema, 'enum') &&
    (!captureSourceEnum.includes('manual') || !captureSourceEnum.includes('operator_browser_geolocation'))
  ) {
    return { config: null, error: 'El esquema restringe la procedencia de ubicación a valores que esta consola no puede garantizar.' };
  }

  const requirementResult = parseLocationRequirement(fieldSchema, fieldRequired);
  if (!requirementResult.config) return { config: null, error: requirementResult.error };
  let requirement = requirementResult.config;
  const actionRequiresLat = actionRequired.has('lat');
  const actionRequiresLng = actionRequired.has('lng');
  if (actionRequiresLat !== actionRequiresLng) {
    return { config: null, error: 'La acción exige una coordenada raíz incompleta.' };
  }
  if (shape === 'root' && actionRequiresLat && actionRequiresLng) {
    if (requirement === 'address') {
      return { config: null, error: 'El esquema permite dirección, pero la acción exige coordenadas; el contrato es contradictorio.' };
    }
    requirement = fieldRequired.has('address') ? 'both' : 'coordinates';
  }
  if (shape === 'root' && actionRequired.has('address')) {
    if (requirement === 'coordinates') {
      return { config: null, error: 'El esquema exige coordenadas, pero la acción exige dirección; el contrato es contradictorio.' };
    }
    requirement = actionRequiresLat ? 'both' : 'address';
  }

  const allowsCoordinates = hasLat && hasLng;
  const allowsAddress = Object.keys(addressSchema).length > 0;
  const allowsLabel = Object.keys(labelSchema).length > 0;
  const allowsCaptureSource = Object.keys(captureSourceSchema).length > 0;
  const requiresLabel = fieldRequired.has('label') || (shape === 'root' && actionRequired.has('label'));
  const requiresCaptureSource = fieldRequired.has('capture_source') ||
    (shape === 'root' && actionRequired.has('capture_source'));
  if ((requirement === 'coordinates' || requirement === 'both') && !allowsCoordinates) {
    return { config: null, error: 'El esquema exige coordenadas, pero no publicó latitud y longitud.' };
  }
  if ((requirement === 'address' || requirement === 'both') && !allowsAddress) {
    return { config: null, error: 'El esquema exige dirección, pero no publicó ese campo.' };
  }
  if (requirement === 'either' && !allowsCoordinates && !allowsAddress) {
    return { config: null, error: 'El esquema no publicó una dirección ni coordenadas utilizables.' };
  }
  if (requiresLabel && !allowsLabel) {
    return { config: null, error: 'La acción exige una etiqueta que el esquema no publicó.' };
  }
  if (requiresCaptureSource && !allowsCaptureSource) {
    return { config: null, error: 'La acción exige procedencia de ubicación, pero el esquema no publicó ese campo.' };
  }

  const latMin = Math.max(-90, finiteNumber(latSchema.minimum) ?? -90);
  const latMax = Math.min(90, finiteNumber(latSchema.maximum) ?? 90);
  const lngMin = Math.max(-180, finiteNumber(lngSchema.minimum) ?? -180);
  const lngMax = Math.min(180, finiteNumber(lngSchema.maximum) ?? 180);
  if (latMin > latMax || lngMin > lngMax) {
    return { config: null, error: 'El esquema publicó rangos de coordenadas inválidos.' };
  }

  return {
    config: {
      shape,
      requirement,
      allowsCoordinates,
      allowsAddress,
      allowsLabel,
      allowsCaptureSource,
      requiresLabel,
      latMin,
      latMax,
      lngMin,
      lngMax,
      labelMaxLength: positiveInteger(labelSchema.maxLength, 100),
      addressMaxLength: positiveInteger(addressSchema.maxLength, 300),
    },
    error: null,
  };
};

const disabledReason = (kind: TicketShareActionKind, action: SaasAction): string =>
  action.disabled_reason?.trim() ||
  `El backend marcó ${kind === 'location' ? 'la ubicación' : kind === 'form' ? 'el formulario' : 'el adjunto'} como no disponible.`;

const getDeliveryContractBlockReason = (action: SaasAction): string | null => {
  if (action.delivery_mode === 'crm_only') {
    const internalModes = new Set(['crm_only', 'internal_event', 'timeline_only']);
    const hasExternalMode = (action.delivery_modes || []).some((mode) => !internalModes.has(mode));
    return action.external_dispatch === false &&
      action.direct_external_dispatch !== true &&
      action.may_queue_external_delivery !== true &&
      !hasExternalMode &&
      action.delivery_contract_version === 'inbox.action_delivery.v2'
      ? null
      : 'La acción CRM-only no publicó evidencia auditable que garantice cero despacho externo.';
  }
  if (action.delivery_mode === 'runtime_preflight') {
    const deliveryModes = action.delivery_modes || [];
    const safeModes = new Set(['durable_queue', 'internal_event']);
    return action.external_dispatch === false &&
      action.direct_external_dispatch === false &&
      action.may_queue_external_delivery === true &&
      action.action_response_delivery_authoritative === true &&
      action.final_delivery_authority === 'provider_status_callback' &&
      deliveryModes.includes('durable_queue') &&
      !deliveryModes.some((mode) => !safeModes.has(mode))
      ? null
      : 'La acción de preflight no publicó cola durable y autoridad final compatibles.';
  }
  return 'La acción no publicó un modo de entrega de artefactos compatible.';
};

const hasStableIdempotencyContract = (action: SaasAction): boolean => {
  const idempotency = asRecord(action.idempotency);
  return (action.requires || []).includes(IDEMPOTENCY_HEADER) || (
    idempotency.preferred_header === IDEMPOTENCY_HEADER &&
    idempotency.body_field === 'client_message_id' &&
    idempotency.retry_rule === 'reuse_same_value'
  );
};

export const getTicketShareActionBlockReason = (
  kind: TicketShareActionKind,
  action: SaasAction | null,
  replyContract?: PlainRecord,
  attachments: unknown[] = [],
): string | null => {
  if (!action) return 'Este ticket no publicó una acción backend compatible.';
  if (action.enabled !== true || action.disabled === true) return disabledReason(kind, action);
  if (
    (action.method || '').toUpperCase() !== 'POST' ||
    !action.endpoint?.startsWith('/') ||
    action.endpoint.startsWith('//') ||
    action.endpoint.includes('\\')
  ) {
    return 'La acción no publicó un endpoint POST seguro.';
  }
  const deliveryBlockReason = getDeliveryContractBlockReason(action);
  if (deliveryBlockReason) return deliveryBlockReason;
  if (!hasStableIdempotencyContract(action)) return 'La acción no publicó una identidad idempotente reutilizable.';
  if (kind === 'location') return resolveLocationInputConfig(action).error;
  if (kind === 'form') return resolveFormInputConfig(action, replyContract).error;
  if (!(action.requires || []).includes('attachment_id')) return 'La acción no exige un attachment_id verificable.';
  if (!getAttachmentOptions(attachments).length) {
    return 'No hay adjuntos existentes con ID verificable en este ticket. Esta acción no carga archivos nuevos.';
  }
  return null;
};

const parseCoordinate = (value: string): number | null =>
  value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;

const TicketShareActionDialog: React.FC<TicketShareActionDialogProps> = ({
  action,
  kind,
  open,
  replyContract,
  attachments = [],
  submitting = false,
  errorMessage,
  onOpenChange,
  onConfirm,
}) => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [selectedOptionKey, setSelectedOptionKey] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [captureSource, setCaptureSource] = useState<'manual' | 'operator_browser_geolocation'>('manual');
  const formResult = useMemo(() => resolveFormInputConfig(action, replyContract), [action, replyContract]);
  const locationResult = useMemo(() => resolveLocationInputConfig(action), [action]);
  const options = useMemo(
    () => kind === 'attachment' ? getAttachmentOptions(attachments) : formResult.config?.options || [],
    [attachments, formResult.config?.options, kind],
  );
  const actionBlockReason = useMemo(
    () => getTicketShareActionBlockReason(kind, action, replyContract, attachments),
    [action, attachments, kind, replyContract],
  );

  useEffect(() => {
    if (!open) return;
    setLatitude('');
    setLongitude('');
    setLabel('');
    setAddress('');
    setSelectedOptionKey('');
    setValidationError(null);
    setGeoStatus(null);
    setCaptureSource('manual');
  }, [action?.id, kind, open]);

  const locationConfig = locationResult.config;
  const useCurrentLocation = () => {
    if (!locationConfig?.allowsCoordinates) {
      setGeoStatus('El contrato backend no habilitó coordenadas para esta acción.');
      return;
    }
    if (!navigator.geolocation) {
      setGeoStatus('Este navegador no ofrece geolocalización. Podés ingresar los datos manualmente.');
      return;
    }
    setGeoStatus('Solicitando permiso de ubicación…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude.toFixed(6));
        setLongitude(coords.longitude.toFixed(6));
        setCaptureSource('operator_browser_geolocation');
        setGeoStatus('GPS del dispositivo del operador cargado. Revisalo antes de confirmar.');
      },
      () => setGeoStatus('No se pudo obtener la ubicación. Podés ingresarla manualmente.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleConfirm = () => {
    setValidationError(null);
    if (actionBlockReason) {
      setValidationError(actionBlockReason);
      return;
    }
    if (kind === 'attachment') {
      const selected = options.find((option) => optionKey(option.value) === selectedOptionKey);
      const id = positiveId(selected?.value);
      if (!id) {
        setValidationError('Seleccioná un adjunto existente del ticket.');
        return;
      }
      onConfirm({ attachment_id: id });
      return;
    }
    if (kind === 'form') {
      const formConfig = formResult.config;
      const selected = formConfig?.options.find((option) => optionKey(option.value) === selectedOptionKey);
      if (!formConfig || !selected) {
        setValidationError(formResult.error || 'Seleccioná un formulario publicado.');
        return;
      }
      onConfirm({ [formConfig.field]: selected.value });
      return;
    }
    if (!locationConfig) {
      setValidationError(locationResult.error || 'El contrato de ubicación no es compatible.');
      return;
    }

    const lat = parseCoordinate(latitude);
    const lng = parseCoordinate(longitude);
    const hasAnyCoordinate = Boolean(latitude.trim() || longitude.trim());
    const hasValidCoordinates = lat !== null && lng !== null &&
      lat >= locationConfig.latMin && lat <= locationConfig.latMax &&
      lng >= locationConfig.lngMin && lng <= locationConfig.lngMax;
    const safeAddress = address.trim().slice(0, locationConfig.addressMaxLength);
    const safeLabel = label.trim().slice(0, locationConfig.labelMaxLength);
    const needsCoordinates = locationConfig.requirement === 'coordinates' || locationConfig.requirement === 'both';
    const needsAddress = locationConfig.requirement === 'address' || locationConfig.requirement === 'both';
    if (hasAnyCoordinate && !hasValidCoordinates) {
      setValidationError('Ingresá latitud y longitud completas dentro de los rangos publicados.');
      return;
    }
    if (needsCoordinates && !hasValidCoordinates) {
      setValidationError('Ingresá latitud y longitud para continuar.');
      return;
    }
    if (needsAddress && !safeAddress) {
      setValidationError('Ingresá la dirección o referencia requerida.');
      return;
    }
    if (locationConfig.requirement === 'either' && !hasValidCoordinates && !safeAddress) {
      setValidationError('Ingresá una dirección o coordenadas completas para continuar.');
      return;
    }
    if (locationConfig.requiresLabel && !safeLabel) {
      setValidationError('Ingresá la etiqueta requerida.');
      return;
    }

    const locationPayload: PlainRecord = {};
    if (locationConfig.allowsCoordinates && hasValidCoordinates) {
      locationPayload.lat = lat;
      locationPayload.lng = lng;
    }
    if (locationConfig.allowsAddress && safeAddress) locationPayload.address = safeAddress;
    if (locationConfig.allowsLabel && safeLabel) locationPayload.label = safeLabel;
    if (locationConfig.allowsCaptureSource) locationPayload.capture_source = captureSource;
    onConfirm(locationConfig.shape === 'nested' ? { location: locationPayload } : locationPayload);
  };

  const noun = kind === 'location' ? 'ubicación' : kind === 'form' ? 'formulario' : 'adjunto';
  const crmOnly = action?.delivery_mode === 'crm_only';
  const dialogDescription = crmOnly
    ? 'Se guardará en CRM, no se enviará externamente. Esta acción no confirma WhatsApp ni entrega al ciudadano.'
    : 'El backend verificará el canal al confirmar. Puede quedar en cola; la entrega final sólo se confirma con evidencia del proveedor.';
  const confirmLabel = submitting
    ? crmOnly ? 'Guardando…' : 'Procesando…'
    : crmOnly ? 'Guardar en CRM' : kind === 'form' ? 'Compartir formulario' : 'Confirmar ubicación';

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{action?.label || `Guardar ${noun}`}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        {kind === 'location' ? (
          <div className="space-y-4">
            {locationConfig?.allowsCoordinates ? (
              <>
                <Button type="button" variant="outline" onClick={useCurrentLocation}>Usar mi ubicación</Button>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {geoStatus || 'La geolocalización sólo se solicita al presionar el botón.'}
                </p>
                <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
                  El GPS corresponde al dispositivo del operador. No modifica ni prueba la ubicación reportada del reclamo.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    Latitud
                    <Input aria-label="Latitud WGS84" inputMode="decimal" value={latitude} onChange={(event) => {
                      setLatitude(event.target.value);
                      setCaptureSource('manual');
                    }} />
                  </label>
                  <label className="space-y-1 text-sm">
                    Longitud
                    <Input aria-label="Longitud WGS84" inputMode="decimal" value={longitude} onChange={(event) => {
                      setLongitude(event.target.value);
                      setCaptureSource('manual');
                    }} />
                  </label>
                </div>
              </>
            ) : null}
            {locationConfig?.allowsAddress ? (
              <label className="space-y-1 text-sm">
                Dirección o referencia
                <Input aria-label="Dirección o referencia" value={address} maxLength={locationConfig.addressMaxLength} onChange={(event) => setAddress(event.target.value)} />
              </label>
            ) : null}
            {locationConfig?.allowsLabel ? (
              <label className="space-y-1 text-sm">
                Etiqueta{locationConfig.requiresLabel ? '' : ' opcional'}
                <Input aria-label="Etiqueta de ubicación" value={label} maxLength={locationConfig.labelMaxLength} onChange={(event) => setLabel(event.target.value)} />
              </label>
            ) : null}
          </div>
        ) : (
          <label className="space-y-1.5 text-sm">
            {kind === 'form' ? 'Formulario publicado' : 'Adjunto existente'}
            <select
              aria-label={kind === 'form' ? 'Formulario publicado' : 'Adjunto existente'}
              className="h-10 w-full rounded-md border border-input bg-background px-3"
              value={selectedOptionKey}
              onChange={(event) => setSelectedOptionKey(event.target.value)}
            >
              <option value="">Seleccionar</option>
              {options.map((option) => (
                <option key={optionKey(option.value)} value={optionKey(option.value)}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        {(validationError || errorMessage || actionBlockReason) ? (
          <p role="alert" className="text-sm text-destructive">{validationError || errorMessage || actionBlockReason}</p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={submitting || Boolean(actionBlockReason)} onClick={handleConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketShareActionDialog;
