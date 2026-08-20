import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, FileText, Loader2, Search, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  hasSuggestionMetadata,
  hasUnresolvedTemplateVariables,
  listResponseTemplates,
  previewResponseTemplateForTicket,
  responseTemplateQueryKeys,
  suggestResponseTemplates,
  type ResponseTemplate,
  type ResponseTemplateSuggestionMetadata,
  type ResponseTemplateTicketSourceModel,
} from '@/features/tickets/responseTemplatesApi';

interface ResponseTemplatePickerProps {
  children: React.ReactElement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (renderedText: string) => void;
  tenantSlug: string | null;
  ticketId: string | number | null;
  ticketKey: string | null;
  sourceModel: ResponseTemplateTicketSourceModel | null;
  metadata: ResponseTemplateSuggestionMetadata;
  managementHref: string;
}

interface TemplateGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  templates: ResponseTemplate[];
}

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();

const matchesSearch = (template: ResponseTemplate, normalizedSearch: string) => {
  if (!normalizedSearch) return true;
  return normalizeSearchText(
    [template.name, template.text, ...template.keywords].join(' '),
  ).includes(normalizedSearch);
};

const ResponseTemplatePicker: React.FC<ResponseTemplatePickerProps> = ({
  children,
  open,
  onOpenChange,
  onSelectTemplate,
  tenantSlug,
  ticketId,
  ticketKey,
  sourceModel,
  metadata,
  managementHref,
}) => {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [preparingTemplateId, setPreparingTemplateId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const previewRequestRef = useRef(0);

  const listQuery = useQuery({
    queryKey: responseTemplateQueryKeys.list(tenantSlug || 'tenant-missing'),
    queryFn: () => (tenantSlug ? listResponseTemplates(tenantSlug) : Promise.resolve([])),
    enabled: open && Boolean(tenantSlug),
    staleTime: 60_000,
  });

  const suggestionsQuery = useQuery({
    queryKey: responseTemplateQueryKeys.suggestions(
      tenantSlug || 'tenant-missing',
      ticketKey || 'ticket-missing',
      metadata,
    ),
    queryFn: () =>
      tenantSlug
        ? suggestResponseTemplates({ tenantSlug, metadata })
        : Promise.resolve([]),
    enabled:
      open &&
      Boolean(tenantSlug) &&
      Boolean(ticketKey) &&
      hasSuggestionMetadata(metadata),
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    previewRequestRef.current += 1;
    setPreparingTemplateId(null);
    setSelectionError(null);
  }, [open, sourceModel, tenantSlug, ticketId, ticketKey]);

  useEffect(
    () => () => {
      previewRequestRef.current += 1;
    },
    [],
  );

  const groups = useMemo<TemplateGroup[]>(() => {
    const catalog = listQuery.data || [];
    const catalogById = new Map(catalog.map((template) => [template.id, template]));
    const suggested = (suggestionsQuery.data || [])
      .map((template) => {
        const catalogTemplate = catalogById.get(template.id);
        if (!catalogTemplate) return null;
        const suggestedTemplate: ResponseTemplate = {
          ...catalogTemplate,
          score: template.score,
        };
        return suggestedTemplate;
      })
      .filter((template): template is ResponseTemplate => Boolean(template));
    const suggestedIds = new Set(suggested.map((template) => template.id));
    const normalizedSearch = normalizeSearchText(search);
    const visible = (templates: ResponseTemplate[]) =>
      templates.filter((template) => matchesSearch(template, normalizedSearch));

    return [
      {
        id: 'suggested',
        label: 'Sugeridas para este caso',
        icon: Sparkles,
        templates: visible(suggested),
      },
      {
        id: 'organization',
        label: 'De esta organización',
        icon: Building2,
        templates: visible(
          catalog.filter(
            (template) => template.scope === 'tenant' && !suggestedIds.has(template.id),
          ),
        ),
      },
      {
        id: 'base',
        label: 'Base institucional',
        icon: FileText,
        templates: visible(
          catalog.filter(
            (template) => template.scope === 'global' && !suggestedIds.has(template.id),
          ),
        ),
      },
    ].filter((group) => group.templates.length > 0);
  }, [listQuery.data, search, suggestionsQuery.data]);

  const visibleTemplates = useMemo(
    () => groups.flatMap((group) => group.templates),
    [groups],
  );

  useEffect(() => {
    setActiveIndex((current) =>
      visibleTemplates.length ? Math.min(current, visibleTemplates.length - 1) : 0,
    );
  }, [visibleTemplates.length]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      previewRequestRef.current += 1;
      setSearch('');
      setActiveIndex(0);
      setSelectionError(null);
      setPreparingTemplateId(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSelect = async (template: ResponseTemplate) => {
    if (preparingTemplateId) return;
    if (!tenantSlug || ticketId === null || ticketId === undefined || !sourceModel) {
      setSelectionError(
        'No pudimos validar el ticket y su organización. Cerrá esta ventana y volvé a abrir el caso.',
      );
      return;
    }

    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setSelectionError(null);
    setPreparingTemplateId(template.id);
    try {
      const preview = await previewResponseTemplateForTicket({
        tenantSlug,
        templateId: template.id,
        ticketId,
        sourceModel,
      });
      if (previewRequestRef.current !== requestId) return;

      onSelectTemplate(preview.renderedText);
      handleOpenChange(false);
    } catch {
      if (previewRequestRef.current !== requestId) return;
      setSelectionError(
        `No se insertó “${template.name}”: no pudimos preparar una versión segura para este ticket. Reintentá o elegí otra respuesta.`,
      );
    } finally {
      if (previewRequestRef.current === requestId) {
        setPreparingTemplateId(null);
      }
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleOpenChange(false);
      return;
    }

    if (!visibleTemplates.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleTemplates.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? visibleTemplates.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void handleSelect(visibleTemplates[activeIndex] || visibleTemplates[0]);
    }
  };

  let itemIndex = -1;
  const isCatalogLoading = listQuery.isPending && listQuery.fetchStatus === 'fetching';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="flex max-h-[min(760px,90vh)] flex-col gap-0 overflow-hidden p-0 motion-reduce:animate-none motion-reduce:transition-none sm:max-w-2xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12 text-left">
          <DialogTitle>Insertar respuesta del equipo</DialogTitle>
          <DialogDescription>
            Elegí un texto y revisalo en el composer. Nada se envía automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/70 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActiveIndex(0);
                setSelectionError(null);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar por nombre, texto o palabra clave"
              className="h-11 pl-9 pr-16"
              role="combobox"
              aria-label="Buscar respuestas rápidas"
              aria-controls="response-template-results"
              aria-expanded={open}
              aria-autocomplete="list"
              aria-activedescendant={
                visibleTemplates[activeIndex]
                  ? `response-template-${visibleTemplates[activeIndex].id}`
                  : undefined
              }
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-flex">
              Enter
            </kbd>
          </div>
        </div>

        {selectionError ? (
          <div
            role="alert"
            className="mx-4 mt-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-5 text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{selectionError}</span>
          </div>
        ) : null}

        {preparingTemplateId ? (
          <div
            role="status"
            aria-live="polite"
            className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary"
          >
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            Preparando una versión segura con los datos autorizados del ticket…
          </div>
        ) : null}

        {suggestionsQuery.isError && !listQuery.isError ? (
          <div className="mx-4 mt-4 rounded-xl border border-border/70 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
            Las sugerencias contextuales no están disponibles ahora. El catálogo completo sigue habilitado.
          </div>
        ) : null}

        <div
          id="response-template-results"
          role="listbox"
          aria-label="Respuestas disponibles"
          aria-busy={isCatalogLoading || Boolean(preparingTemplateId)}
          className="min-h-0 flex-1 overflow-y-auto p-3"
        >
          {!tenantSlug ? (
            <div className="p-6 text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-amber-600" />
              <p className="mt-2 text-sm font-semibold">No pudimos identificar la organización.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Volvé a abrir el caso desde su bandeja antes de usar una respuesta guardada.
              </p>
            </div>
          ) : isCatalogLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Cargando respuestas del equipo…
            </div>
          ) : listQuery.isError ? (
            <div className="p-6 text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-amber-600" />
              <p className="mt-2 text-sm font-semibold">No pudimos cargar las respuestas guardadas.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => void listQuery.refetch()}
              >
                Reintentar
              </Button>
            </div>
          ) : !visibleTemplates.length ? (
            <div className="p-8 text-center">
              <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">
                {search ? 'No hay coincidencias' : 'Todavía no hay respuestas disponibles'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search
                  ? 'Probá con menos palabras o revisá el catálogo.'
                  : 'Creá una respuesta reutilizable desde la configuración.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <section key={group.id} aria-labelledby={`response-template-group-${group.id}`}>
                    <h3
                      id={`response-template-group-${group.id}`}
                      className="flex items-center gap-2 px-2 pb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      <GroupIcon className="h-3.5 w-3.5" />
                      {group.label}
                    </h3>
                    <div className="space-y-1">
                      {group.templates.map((template) => {
                        itemIndex += 1;
                        const currentIndex = itemIndex;
                        const hasVariables = hasUnresolvedTemplateVariables(template.text);
                        return (
                          <button
                            key={`${group.id}-${template.id}`}
                            id={`response-template-${template.id}`}
                            type="button"
                            role="option"
                            aria-selected={currentIndex === activeIndex}
                            aria-busy={preparingTemplateId === template.id}
                            disabled={Boolean(preparingTemplateId)}
                            onMouseEnter={() => setActiveIndex(currentIndex)}
                            onFocus={() => setActiveIndex(currentIndex)}
                            onClick={() => void handleSelect(template)}
                            className={cn(
                              'w-full rounded-xl border px-3 py-3 text-left outline-none transition-colors disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none',
                              currentIndex === activeIndex
                                ? 'border-primary/45 bg-primary/5 ring-1 ring-primary/15'
                                : 'border-transparent hover:border-border hover:bg-muted/45',
                            )}
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-foreground">
                                  {template.name}
                                </span>
                                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                                  {template.text}
                                </span>
                              </span>
                              {preparingTemplateId === template.id ? (
                                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
                              ) : hasVariables ? (
                                <span className="shrink-0 rounded-full border border-primary/25 bg-primary/5 px-2 py-1 text-[10px] font-bold text-primary">
                                  Completa datos del caso
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>↑ ↓ para navegar · Enter para insertar · Esc para cerrar</span>
          <Button asChild variant="ghost" size="sm" className="h-8 justify-start px-2 sm:justify-center">
            <Link to={managementHref} onClick={() => handleOpenChange(false)}>
              Administrar respuestas
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResponseTemplatePicker;
