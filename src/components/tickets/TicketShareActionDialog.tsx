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
import { formatTicketDisplayLabel } from '@/utils/ticketStatus';

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
  return asArray(raw.options).flatMap((candidate, index) => {
    const item = asRecord(candidate);
    const id = positiveId(item.form_id ?? item.id);
    const label = text(item.label ?? item.name ?? item.title);
    const evidence = asRecord(item.evidence);
    const approved = item.approved === true && item.tenant_owned === true && item.tenant_verified === true &&
      evidence.approved === true && evidence.tenant_owned === true && evidence.flow_contract_verified === true;
    return id && label && approved
      ? [{ value: id, label: formatTicketDisplayLabel(label, `Formulario ${index + 1}`) }]
      : [];
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
    return { config: null, error: 'No pudimos verificar la lista de formularios disponibles.' };
  }

  const hasPublishedEnum = Object.prototype.hasOwnProperty.call(propertySchema, 'enum');
  const rawEnumValues = asArray(propertySchema.enum);
  const enumValues = rawEnumValues.flatMap<OptionValue>((value): OptionValue[] => {
    if (field === 'form_slug' && typeof value === 'string' && value.trim()) return [value.trim()];
    const id = field === 'form_id' ? positiveId(value) : null;
    return id ? [id] : [];
  });
  if (hasPublishedEnum && !enumValues.length) {
    return { config: null, error: 'No hay formularios válidos para seleccionar.' };
  }
  const enumKeys = new Set(enumValues.map(optionKey));
  const formSelection = asRecord(asRecord(replyContract).form_selection);
  const publishedOptions = asArray(formSelection.options).flatMap<VerifiedOption>((candidate, index): VerifiedOption[] => {
    const item = asRecord(candidate);
    const value = field === 'form_slug' ? text(item.form_slug) : positiveId(item.form_id ?? item.id);
    const label = text(item.label ?? item.name ?? item.title);
    if (value === null || !label) return [];
    if (hasPublishedEnum && !enumKeys.has(optionKey(value))) return [];
    return [{ value, label: formatTicketDisplayLabel(label, `Formulario ${index + 1}`) }];
  });
  if (source && !publishedOptions.length) {
    return { config: null, error: 'No hay opciones disponibles para seleccionar el formulario.' };
  }
  const options = publishedOptions.length
    ? publishedOptions
    : enumValues.map((value, index) => ({ value, label: `Formulario ${index + 1}` }));
  if (!options.length) {
    return { config: null, error: 'No hay formularios disponibles para seleccionar.' };
  }
  return { config: dedupeOptions(options), error: null };
};

const resolveFormInputConfig = (
  action: SaasAction | null,
  replyContract?: PlainRecord,
): ConfigResult<FormInputConfig> => {
  if (!action) return { config: null, error: 'Este caso no tiene una acción de formulario disponible.' };
  const schema = asRecord(action.input_schema);
  if (!Object.keys(schema).length) {
    const required = new Set(action.requires || []);
    if (!required.has('form_id') || required.has('form_slug')) {
      return { config: null, error: 'No pudimos validar la configuración del formulario.' };
    }
    const options = getLegacyFormOptions(action);
    return options.length
      ? { config: { field: 'form_id', options }, error: null }
      : { config: null, error: 'No hay formularios aprobados para compartir en este caso.' };
  }
  if (schema.type !== 'object') {
    return { config: null, error: 'No pudimos validar la configuración del formulario.' };
  }
  const properties = asRecord(schema.properties);
  const candidates = (['form_slug', 'form_id'] as const)
    .filter((field) => Object.keys(asRecord(properties[field])).length > 0);
  if (candidates.length !== 1) {
    return { config: null, error: 'No pudimos identificar un único formulario para esta acción.' };
  }
  const field = candidates[0];
  const propertySchema = asRecord(properties[field]);
  if (
    (field === 'form_slug' && propertySchema.type !== 'string') ||
    (field === 'form_id' && propertySchema.type !== 'integer' && propertySchema.type !== 'number')
  ) {
    return { config: null, error: 'La identificación del formulario no es compatible.' };
  }
  const schemaRequired = new Set(strings(schema.required));
  if (!schemaRequired.has(field)) {
    return { config: null, error: 'No pudimos verificar qué formulario corresponde compartir.' };
  }
  const defaults = getActionDefaults(action);
  const unsupportedRequired = [...schemaRequired].filter(
    (requiredField) => requiredField !== field && !META_FIELDS.has(requiredField) && isMissing(defaults[requiredField]),
  );
  if (unsupportedRequired.length) {
    return { config: null, error: 'El formulario pide datos que esta consola no puede completar.' };
  }
  const actionFormFields = (action.requires || [])
    .filter((requiredField) => requiredField === 'form_slug' || requiredField === 'form_id');
  if (actionFormFields.some((requiredField) => requiredField !== field)) {
    return { config: null, error: 'La configuración del formulario es incompatible con esta acción.' };
  }
  const unsupportedActionRequired = (action.requires || []).filter(
    (requiredField) => requiredField !== field && !META_FIELDS.has(requiredField) && isMissing(defaults[requiredField]),
  );
  if (unsupportedActionRequired.length) {
    return { config: null, error: 'El formulario pide datos que esta consola no puede completar.' };
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
  const requiresLat = requiredFields.has('lat');
  const requiresLng = requiredFields.has('lng');
  if (requiresLat !== requiresLng) {
    return { config: null, error: 'La ubicación necesita latitud y longitud.' };
  }
  const requiresCoordinates = requiresLat && requiresLng;
  const requiresAddress = requiredFields.has('address');

  const alternatives = asArray(schema.anyOf);
  if (alternatives.length) {
    const alternativeKinds = alternatives.flatMap((candidate) => {
      const required = new Set(strings(asRecord(candidate).required));
      if (required.size === 1 && required.has('address')) return ['address' as const];
      if (required.size === 2 && required.has('lat') && required.has('lng')) return ['coordinates' as const];
      return [];
    });
    if (alternativeKinds.length !== alternatives.length) {
      return { config: null, error: 'No pudimos validar las opciones de ubicación.' };
    }
    const kinds = new Set(alternativeKinds);
    if (requiresCoordinates && requiresAddress) return { config: 'both', error: null };
    if (requiresCoordinates) {
      return { config: kinds.has('coordinates') ? 'coordinates' : 'both', error: null };
    }
    if (requiresAddress) {
      return { config: kinds.has('address') ? 'address' : 'both', error: null };
    }
    if (kinds.has('address') && kinds.has('coordinates')) return { config: 'either', error: null };
    if (kinds.has('coordinates')) return { config: 'coordinates', error: null };
    if (kinds.has('address')) return { config: 'address', error: null };
  }
  if (requiresCoordinates && requiresAddress) return { config: 'both', error: null };
  if (requiresCoordinates) return { config: 'coordinates', error: null };
  if (requiresAddress) return { config: 'address', error: null };
  return { config: 'either', error: null };
};

const resolveLocationInputConfig = (action: SaasAction | null): ConfigResult<LocationInputConfig> => {
  if (!action) return { config: null, error: 'Este caso no tiene una acción de ubicación disponible.' };
  const schema = asRecord(action.input_schema);
  const defaults = getActionDefaults(action);
  if (!Object.keys(schema).length) {
    const required = new Set(action.requires || []);
    const accepted = new Set([...required, ...strings(asRecord(action.raw).accepted_fields)]);
    if (!accepted.has('lat') || !accepted.has('lng')) {
      return { config: null, error: 'La ubicación no incluye latitud y longitud válidas.' };
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
    return { config: null, error: 'No pudimos validar la configuración de la ubicación.' };
  }

  const topProperties = asRecord(schema.properties);
  const nestedLocation = asRecord(topProperties.location);
  const hasNestedLocation = Object.keys(nestedLocation).length > 0;
  const hasRootLocationFields = [...LOCATION_FIELDS]
    .filter((field) => field !== 'location')
    .some((field) => Object.keys(asRecord(topProperties[field])).length > 0);
  if (hasNestedLocation && hasRootLocationFields) {
    return { config: null, error: 'La configuración de ubicación es incompatible con esta acción.' };
  }

  const shape: LocationInputConfig['shape'] = hasNestedLocation ? 'nested' : 'root';
  if (shape === 'nested' && nestedLocation.type !== 'object') {
    return { config: null, error: 'No pudimos validar la ubicación informada.' };
  }
  const fieldSchema = shape === 'nested' ? nestedLocation : schema;
  const properties = shape === 'nested' ? asRecord(nestedLocation.properties) : topProperties;
  if (asArray(fieldSchema.oneOf).length || asArray(fieldSchema.allOf).length) {
    return { config: null, error: 'No pudimos interpretar la configuración de la ubicación.' };
  }
  const topRequired = new Set(strings(schema.required));
  const fieldRequired = new Set(strings(fieldSchema.required));
  const actionRequired = new Set(action.requires || []);

  if (shape === 'nested') {
    if (!topRequired.has('location') && !actionRequired.has('location')) {
      return { config: null, error: 'No pudimos verificar la ubicación requerida.' };
    }
    if ([...actionRequired].some((field) => ['lat', 'lng', 'address', 'label', 'capture_source'].includes(field))) {
      return { config: null, error: 'La configuración de ubicación es incompatible con esta acción.' };
    }
  } else if (actionRequired.has('location')) {
    return { config: null, error: 'La configuración de ubicación es incompatible con esta acción.' };
  }

  const unsupportedRequired = [
    ...(shape === 'nested' ? [...topRequired].filter((field) => field !== 'location') : [...fieldRequired]),
    ...(shape === 'nested' ? [...fieldRequired].filter((field) => !LOCATION_FIELDS.has(field)) : []),
    ...[...actionRequired].filter((field) => !LOCATION_FIELDS.has(field) && !META_FIELDS.has(field) && isMissing(defaults[field])),
  ].filter((field) => !META_FIELDS.has(field) && !LOCATION_FIELDS.has(field) && isMissing(defaults[field]));
  if (unsupportedRequired.length) {
    return { config: null, error: 'La ubicación pide datos que esta consola no puede completar.' };
  }

  const latSchema = asRecord(properties.lat);
  const lngSchema = asRecord(properties.lng);
  const addressSchema = asRecord(properties.address);
  const labelSchema = asRecord(properties.label);
  const captureSourceSchema = asRecord(properties.capture_source);
  const hasLat = Object.keys(latSchema).length > 0;
  const hasLng = Object.keys(lngSchema).length > 0;
  if (hasLat !== hasLng) {
    return { config: null, error: 'La ubicación necesita latitud y longitud.' };
  }
  if ((hasLat && latSchema.type !== 'number') || (hasLng && lngSchema.type !== 'number')) {
    return { config: null, error: 'Las coordenadas informadas no son válidas.' };
  }
  if (Object.keys(addressSchema).length && addressSchema.type !== 'string') {
    return { config: null, error: 'La dirección informada no es válida.' };
  }
  if (Object.keys(labelSchema).length && labelSchema.type !== 'string') {
    return { config: null, error: 'La etiqueta de ubicación no es válida.' };
  }
  if (Object.keys(captureSourceSchema).length && captureSourceSchema.type !== 'string') {
    return { config: null, error: 'No pudimos verificar cómo se obtuvo la ubicación.' };
  }
  const captureSourceEnum = asArray(captureSourceSchema.enum);
  if (
    Object.prototype.hasOwnProperty.call(captureSourceSchema, 'enum') &&
    (!captureSourceEnum.includes('manual') || !captureSourceEnum.includes('operator_browser_geolocation'))
  ) {
    return { config: null, error: 'No pudimos verificar cómo se obtuvo la ubicación.' };
  }

  const requirementResult = parseLocationRequirement(fieldSchema, fieldRequired);
  if (!requirementResult.config) return { config: null, error: requirementResult.error };
  let requirement = requirementResult.config;
  const actionRequiresLat = actionRequired.has('lat');
  const actionRequiresLng = actionRequired.has('lng');
  if (actionRequiresLat !== actionRequiresLng) {
    return { config: null, error: 'La ubicación necesita latitud y longitud.' };
  }
  if (shape === 'root' && actionRequiresLat && actionRequiresLng) {
    if (requirement === 'address') {
      return { config: null, error: 'Esta acción necesita coordenadas.' };
    }
    requirement = fieldRequired.has('address') ? 'both' : 'coordinates';
  }
  if (shape === 'root' && actionRequired.has('address')) {
    if (requirement === 'coordinates') {
      return { config: null, error: 'Esta acción necesita una dirección.' };
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
    return { config: null, error: 'Esta acción necesita latitud y longitud.' };
  }
  if ((requirement === 'address' || requirement === 'both') && !allowsAddress) {
    return { config: null, error: 'Esta acción necesita una dirección.' };
  }
  if (requirement === 'either' && !allowsCoordinates && !allowsAddress) {
    return { config: null, error: 'Esta acción no admite una dirección ni coordenadas utilizables.' };
  }
  if (requiresLabel && !allowsLabel) {
    return { config: null, error: 'Esta acción necesita una etiqueta de ubicación.' };
  }
  if (requiresCaptureSource && !allowsCaptureSource) {
    return { config: null, error: 'No pudimos verificar cómo se obtuvo la ubicación.' };
  }

  const latMin = Math.max(-90, finiteNumber(latSchema.minimum) ?? -90);
  const latMax = Math.min(90, finiteNumber(latSchema.maximum) ?? 90);
  const lngMin = Math.max(-180, finiteNumber(lngSchema.minimum) ?? -180);
  const lngMax = Math.min(180, finiteNumber(lngSchema.maximum) ?? 180);
  if (latMin > latMax || lngMin > lngMax) {
    return { config: null, error: 'Los límites de la ubicación no son válidos.' };
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

const resolveAttachmentOptions = (
  action: SaasAction | null,
  attachments: unknown[] = [],
): ConfigResult<VerifiedOption[]> => {
  if (!action) return { config: null, error: 'Este caso no tiene una acción de adjunto disponible.' };
  const actionRequired = new Set(action.requires || []);
  if (!actionRequired.has('attachment_id')) {
    return { config: null, error: 'No pudimos verificar qué adjunto corresponde compartir.' };
  }

  let options = getAttachmentOptions(attachments);
  const schema = asRecord(action.input_schema);
  if (Object.keys(schema).length) {
    if (schema.type !== 'object' || asArray(schema.anyOf).length || asArray(schema.oneOf).length || asArray(schema.allOf).length) {
      return { config: null, error: 'No pudimos validar la configuración del adjunto.' };
    }
    const properties = asRecord(schema.properties);
    const attachmentSchema = asRecord(properties.attachment_id);
    if (!Object.keys(attachmentSchema).length || !['integer', 'number'].includes(String(attachmentSchema.type))) {
      return { config: null, error: 'No pudimos identificar el adjunto.' };
    }
    const schemaRequired = new Set(strings(schema.required));
    if (!schemaRequired.has('attachment_id')) {
      return { config: null, error: 'No pudimos verificar qué adjunto corresponde compartir.' };
    }
    const defaults = getActionDefaults(action);
    const unsupportedRequired = [...schemaRequired, ...actionRequired].filter(
      (field) => field !== 'attachment_id' && !META_FIELDS.has(field) && isMissing(defaults[field]),
    );
    if (unsupportedRequired.length) {
      return {
        config: null,
        error: 'El adjunto pide datos que esta consola no puede completar.',
      };
    }
    const minimum = finiteNumber(attachmentSchema.minimum);
    const maximum = finiteNumber(attachmentSchema.maximum);
    if (minimum !== null && maximum !== null && minimum > maximum) {
      return { config: null, error: 'La configuración del adjunto no es válida.' };
    }
    const hasPublishedEnum = Object.prototype.hasOwnProperty.call(attachmentSchema, 'enum');
    const allowedIds = new Set(asArray(attachmentSchema.enum).flatMap((value) => {
      const id = positiveId(value);
      return id ? [id] : [];
    }));
    if (hasPublishedEnum && !allowedIds.size) {
      return { config: null, error: 'No hay adjuntos válidos para seleccionar.' };
    }
    options = options.filter((option) => {
      const id = positiveId(option.value);
      return Boolean(
        id &&
        (!hasPublishedEnum || allowedIds.has(id)) &&
        (minimum === null || id >= minimum) &&
        (maximum === null || id <= maximum),
      );
    });
  }

  return options.length
    ? { config: options, error: null }
    : { config: null, error: 'No hay adjuntos disponibles en este caso. Esta acción no carga archivos nuevos.' };
};

const disabledReason = (kind: TicketShareActionKind, action: SaasAction): string =>
  (action.disabled_reason?.trim()
    ? formatTicketDisplayLabel(action.disabled_reason, 'Esta acción no está disponible ahora.')
    : `${kind === 'location' ? 'La ubicación' : kind === 'form' ? 'El formulario' : 'El adjunto'} no está disponible ahora.`);

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
      : 'No se puede confirmar que esta acción quede solo en el caso.';
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
      : 'No pudimos confirmar un envío seguro para esta acción.';
  }
  return 'No pudimos confirmar cómo se va a procesar esta acción.';
};

const hasStableIdempotencyContract = (action: SaasAction): boolean => {
  const idempotency = asRecord(action.idempotency);
  const publishesIdempotency = Object.keys(idempotency).length > 0;
  if (!publishesIdempotency) return (action.requires || []).includes(IDEMPOTENCY_HEADER);
  return (
    (!Object.prototype.hasOwnProperty.call(idempotency, 'contract_version') ||
      idempotency.contract_version === 'inbox.reply_idempotency.v1') &&
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
  if (!action) return 'Este caso no tiene una acción compatible disponible.';
  if (action.enabled !== true || action.disabled === true) return disabledReason(kind, action);
  if (
    (action.method || '').toUpperCase() !== 'POST' ||
    !action.endpoint?.startsWith('/') ||
    action.endpoint.startsWith('//') ||
    action.endpoint.includes('\\')
  ) {
    return 'No hay una acción segura disponible.';
  }
  const deliveryBlockReason = getDeliveryContractBlockReason(action);
  if (deliveryBlockReason) return deliveryBlockReason;
  if (!hasStableIdempotencyContract(action)) return 'No pudimos confirmar que esta acción evite duplicados.';
  if (kind === 'location') return resolveLocationInputConfig(action).error;
  if (kind === 'form') return resolveFormInputConfig(action, replyContract).error;
  return resolveAttachmentOptions(action, attachments).error;
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
  const attachmentResult = useMemo(() => resolveAttachmentOptions(action, attachments), [action, attachments]);
  const options = useMemo(
    () => kind === 'attachment' ? attachmentResult.config || [] : formResult.config?.options || [],
    [attachmentResult.config, formResult.config?.options, kind],
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
      setGeoStatus('Esta acción no permite usar coordenadas.');
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
        setValidationError('Seleccioná un adjunto existente del caso.');
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
      setValidationError(locationResult.error || 'La ubicación no está disponible con la configuración actual.');
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
    ? 'Esta acción queda guardada en el caso. No se envía a la persona porque este canal no tiene envío habilitado.'
    : 'El canal se verifica al confirmar. Puede quedar en espera hasta recibir la confirmación de entrega.';
  const confirmLabel = submitting
    ? crmOnly ? 'Guardando…' : 'Procesando…'
    : crmOnly
      ? 'Guardar en el caso'
      : kind === 'form'
        ? 'Compartir formulario'
        : kind === 'attachment'
          ? 'Confirmar adjunto'
          : 'Confirmar ubicación';

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{action?.label ? formatTicketDisplayLabel(action.label, `Guardar ${noun}`) : `Guardar ${noun}`}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        {kind === 'location' ? (
          <div className="space-y-4">
            {locationConfig?.allowsCoordinates ? (
              <>
                <Button type="button" variant="outline" className="min-h-11" onClick={useCurrentLocation}>Usar mi ubicación</Button>
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
              className="h-11 w-full rounded-md border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" className="min-h-11" disabled={submitting || Boolean(actionBlockReason)} onClick={handleConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketShareActionDialog;
