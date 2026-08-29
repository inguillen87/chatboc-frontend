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

export type TicketShareActionKind = 'location' | 'form';

export type TicketShareActionPayload = {
  location?: {
    address?: string;
    label?: string;
    lat?: number;
    lng?: number;
  };
  form_slug?: string;
};

type PlainRecord = Record<string, unknown>;

type FormSelectionOption = {
  id: string;
  formSlug: string;
  label: string;
  href?: string;
  kind?: string;
};

interface TicketShareActionDialogProps {
  action: SaasAction | null;
  kind: TicketShareActionKind;
  open: boolean;
  replyContract?: PlainRecord;
  submitting?: boolean;
  errorMessage?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: TicketShareActionPayload) => void;
}

const asRecord = (value: unknown): PlainRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as PlainRecord : {};

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];

const getFormSelectionOptions = (replyContract?: PlainRecord): FormSelectionOption[] => {
  const formSelection = asRecord(asRecord(replyContract).form_selection);
  const options = Array.isArray(formSelection.options) ? formSelection.options : [];

  return options.flatMap((candidate) => {
    const option = asRecord(candidate);
    const id = asText(option.id);
    const formSlug = asText(option.form_slug);
    const label = asText(option.label);
    const href = asText(option.href);
    const kind = asText(option.kind);
    if (!id || !formSlug || !label || !href || !kind) return [];
    return [{
      id,
      formSlug,
      label,
      href,
      kind,
    }];
  });
};

const hasRequiredSet = (value: unknown, expected: string[]): boolean => {
  const present = new Set(asStringArray(value));
  return expected.every((field) => present.has(field));
};

const hasCompatibleIdempotency = (action: SaasAction): boolean => {
  const idempotency = asRecord(action.idempotency);
  return (
    asText(idempotency.contract_version) === 'inbox.reply_idempotency.v1' &&
    asText(idempotency.preferred_header) === 'Idempotency-Key' &&
    asText(idempotency.body_field) === 'client_message_id' &&
    asText(idempotency.retry_rule) === 'reuse_same_value'
  );
};

const hasSafeDeliveryContract = (action: SaasAction): boolean => {
  const legacyInternalOnly = (
    action.delivery_mode === 'internal_event' &&
    action.external_dispatch === false
  );
  const modes = new Set(action.delivery_modes || []);
  const runtimePreflight = (
    action.delivery_mode === 'runtime_preflight' &&
    action.external_dispatch === false &&
    action.direct_external_dispatch === false &&
    action.may_queue_external_delivery === true &&
    action.action_response_delivery_authoritative === true &&
    action.final_delivery_authority === 'provider_status_callback' &&
    modes.has('durable_queue') &&
    modes.has('internal_event')
  );
  return legacyInternalOnly || runtimePreflight;
};

export const getTicketShareActionBlockReason = (
  kind: TicketShareActionKind,
  action: SaasAction | null,
  replyContract?: PlainRecord,
): string | null => {
  const label = kind === 'location' ? 'ubicación' : 'formulario';
  if (!action) return `Este ticket no publicó una acción backend compatible para compartir ${label}.`;
  if (action.disabled) return action.disabled_reason || `El backend marcó ${label} como no disponible.`;
  if ((action.method || 'POST').trim().toUpperCase() !== 'POST') {
    return `El contrato de ${label} no publicó un método POST compatible.`;
  }
  if (!action.endpoint?.startsWith('/')) {
    return `El contrato de ${label} no publicó un endpoint seguro.`;
  }
  if (!hasSafeDeliveryContract(action)) {
    return `El contrato de ${label} no publica una decisión de entrega segura y auditable.`;
  }
  if (!hasCompatibleIdempotency(action)) {
    return `El contrato de ${label} no publicó una identidad idempotente compatible.`;
  }

  const schema = asRecord(action.input_schema);
  const properties = asRecord(schema.properties);
  if (asText(schema.type) !== 'object') {
    return `La acción backend de ${label} no publicó un input_schema compatible.`;
  }

  if (kind === 'location') {
    const locationSchema = asRecord(properties.location);
    const locationProperties = asRecord(locationSchema.properties);
    const addressSchema = asRecord(locationProperties.address);
    const labelSchema = asRecord(locationProperties.label);
    const latitudeSchema = asRecord(locationProperties.lat);
    const longitudeSchema = asRecord(locationProperties.lng);
    const anyOf = Array.isArray(locationSchema.anyOf) ? locationSchema.anyOf.map(asRecord) : [];
    const acceptsAddress = anyOf.some((candidate) => hasRequiredSet(candidate.required, ['address']));
    const acceptsCoordinates = anyOf.some((candidate) => hasRequiredSet(candidate.required, ['lat', 'lng']));
    if (
      !hasRequiredSet(schema.required, ['location']) ||
      asText(locationSchema.type) !== 'object' ||
      locationSchema.additionalProperties !== false ||
      asText(addressSchema.type) !== 'string' ||
      asFiniteNumber(addressSchema.maxLength) !== 300 ||
      asText(labelSchema.type) !== 'string' ||
      asFiniteNumber(labelSchema.maxLength) !== 100 ||
      asText(latitudeSchema.type) !== 'number' ||
      asFiniteNumber(latitudeSchema.minimum) !== -90 ||
      asFiniteNumber(latitudeSchema.maximum) !== 90 ||
      asText(longitudeSchema.type) !== 'number' ||
      asFiniteNumber(longitudeSchema.minimum) !== -180 ||
      asFiniteNumber(longitudeSchema.maximum) !== 180 ||
      !acceptsAddress ||
      !acceptsCoordinates
    ) {
      return 'El esquema de ubicación no permite completar dirección o coordenadas de forma segura.';
    }
    return null;
  }

  const formSchema = asRecord(properties.form_slug);
  const schemaOptions = new Set(asStringArray(formSchema.enum));
  const options = getFormSelectionOptions(replyContract);
  const optionSlugs = new Set(options.map((option) => option.formSlug));
  if (
    !hasRequiredSet(schema.required, ['form_slug']) ||
    asText(formSchema.type) !== 'string' ||
    asText(formSchema['x-options-source']) !== 'reply_contract.form_selection.options' ||
    !schemaOptions.size ||
    !options.length ||
    schemaOptions.size !== optionSlugs.size ||
    options.some((option) => !schemaOptions.has(option.formSlug))
  ) {
    return 'El contrato de formulario no publicó opciones válidas para este tenant.';
  }
  return null;
};

const parseCoordinate = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const TicketShareActionDialog: React.FC<TicketShareActionDialogProps> = ({
  action,
  kind,
  open,
  replyContract,
  submitting = false,
  errorMessage,
  onOpenChange,
  onConfirm,
}) => {
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const formOptions = useMemo(() => getFormSelectionOptions(replyContract), [replyContract]);
  const usesRuntimePreflight = action?.delivery_mode === 'runtime_preflight';

  useEffect(() => {
    if (!open) return;
    setAddress('');
    setLabel('');
    setLatitude('');
    setLongitude('');
    setFormSlug('');
    setValidationError(null);
  }, [action?.id, kind, open]);

  const handleConfirm = () => {
    setValidationError(null);
    if (kind === 'form') {
      if (!formSlug || !formOptions.some((option) => option.formSlug === formSlug)) {
        setValidationError('Seleccioná uno de los formularios publicados para este caso.');
        return;
      }
      onConfirm({ form_slug: formSlug });
      return;
    }

    const normalizedAddress = address.trim();
    const normalizedLabel = label.trim();
    const lat = parseCoordinate(latitude);
    const lng = parseCoordinate(longitude);
    const hasCoordinateInput = Boolean(latitude.trim() || longitude.trim());
    const hasValidCoordinates = lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    if (!normalizedAddress && !hasValidCoordinates) {
      setValidationError('Ingresá una dirección o un par válido de latitud y longitud.');
      return;
    }
    if (hasCoordinateInput && !hasValidCoordinates) {
      setValidationError('Las coordenadas deben incluir latitud y longitud dentro de rangos válidos.');
      return;
    }

    onConfirm({
      location: {
        ...(normalizedAddress ? { address: normalizedAddress.slice(0, 300) } : {}),
        ...(normalizedLabel ? { label: normalizedLabel.slice(0, 100) } : {}),
        ...(hasValidCoordinates ? { lat: lat as number, lng: lng as number } : {}),
      },
    });
  };

  const title = action?.label || (kind === 'location' ? 'Compartir ubicación' : 'Compartir formulario');

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {usesRuntimePreflight
              ? 'El backend valida el canal al confirmar: puede encolarla para WhatsApp o guardarla sólo en el CRM. La respuesta mostrará la evidencia real.'
              : 'Esta acción se registra dentro del CRM. No envía un mensaje por WhatsApp.'}
          </DialogDescription>
        </DialogHeader>

        {kind === 'location' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="ticket-share-location-address" className="text-sm font-medium">Dirección</label>
              <Input
                id="ticket-share-location-address"
                value={address}
                maxLength={300}
                placeholder="Calle, altura o referencia"
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ticket-share-location-label" className="text-sm font-medium">Etiqueta opcional</label>
              <Input
                id="ticket-share-location-label"
                value={label}
                maxLength={100}
                placeholder="Ej.: punto de encuentro"
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="ticket-share-location-lat" className="text-sm font-medium">Latitud</label>
                <Input
                  id="ticket-share-location-lat"
                  inputMode="decimal"
                  value={latitude}
                  placeholder="-34.593"
                  onChange={(event) => setLatitude(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ticket-share-location-lng" className="text-sm font-medium">Longitud</label>
                <Input
                  id="ticket-share-location-lng"
                  inputMode="decimal"
                  value={longitude}
                  placeholder="-60.946"
                  onChange={(event) => setLongitude(event.target.value)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="ticket-share-form-select" className="text-sm font-medium">Formulario publicado</label>
            <select
              id="ticket-share-form-select"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={formSlug}
              onChange={(event) => setFormSlug(event.target.value)}
            >
              <option value="">Seleccionar formulario</option>
              {formOptions.map((option) => (
                <option key={option.id} value={option.formSlug}>{option.label}</option>
              ))}
            </select>
          </div>
        )}

        {validationError || errorMessage ? (
          <p className="text-sm text-destructive" role="alert">{validationError || errorMessage}</p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={submitting} onClick={handleConfirm}>
            {submitting
              ? 'Registrando…'
              : usesRuntimePreflight
                ? 'Confirmar y validar canal'
                : 'Confirmar acción interna'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketShareActionDialog;
