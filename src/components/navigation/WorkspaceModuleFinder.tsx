import React, { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

export type WorkspaceModuleFinderItem = {
  id: string;
  label: string;
  description?: string;
  group?: string;
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onSelect: () => void;
};

export type WorkspaceModuleFinderProps = {
  items: readonly WorkspaceModuleFinderItem[];
  contextKey: string;
  triggerLabel?: string;
  className?: string;
};

const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

// A changed scope or permission inventory retires the entire dialog owner in
// render, including its pending focus restoration; no effect can reopen it.
export default function WorkspaceModuleFinder(props: WorkspaceModuleFinderProps) {
  const sessionRevision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision);
  const ownerKey = JSON.stringify([props.contextKey, sessionRevision, [...new Set(props.items.map((item) => item.id))].sort()]);
  return <ModuleFinderSession key={ownerKey} {...props} />;
}

function ModuleFinderSession({ items, triggerLabel = 'Buscar módulo', className }: WorkspaceModuleFinderProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const sessionRef = useRef(0);
  const openRevisionRef = useRef<number | null>(null);
  const selectedRef = useRef(false);
  const restoreRef = useRef<{ session: number; revision: number; content: HTMLDivElement } | null>(null);

  useLayoutEffect(() => {
    mountedRef.current = true;
    const relinquishFocus = (event: FocusEvent) => {
      const request = restoreRef.current;
      if (request && event.target instanceof Node && event.target !== document.body && !request.content.contains(event.target)) restoreRef.current = null;
    };
    document.addEventListener('focusin', relinquishFocus);
    return () => { mountedRef.current = false; restoreRef.current = null; document.removeEventListener('focusin', relinquishFocus); };
  }, []);

  const terms = searchable(query).split(/\s+/).filter(Boolean);
  const results = items.filter((item) => {
    const text = searchable([item.label, item.description, item.group].filter(Boolean).join(' '));
    return terms.every((term) => text.includes(term));
  });

  const openFinder = () => {
    sessionRef.current += 1;
    openRevisionRef.current = captureChatbocSessionRevision();
    selectedRef.current = false;
    restoreRef.current = null;
    setQuery('');
    setOpen(true);
    // An interrupted exit retains the input without another mount autofocus.
    const input = inputRef.current;
    if (input?.isConnected && contentRef.current?.contains(input)) input.focus();
  };

  const closeFromOwnedControl = () => {
    const content = contentRef.current;
    const revision = openRevisionRef.current;
    if (!mountedRef.current || !open || revision === null || !isChatbocSessionRevisionCurrent(revision)) return;
    restoreRef.current = content?.contains(document.activeElement)
      ? { session: sessionRef.current, revision, content } : null;
    setOpen(false);
  };

  const select = (id: string) => {
    if (!mountedRef.current || selectedRef.current || !open || openRevisionRef.current === null || !isChatbocSessionRevisionCurrent(openRevisionRef.current)) return;
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;
    selectedRef.current = true;
    restoreRef.current = null;
    setOpen(false);
    item.onSelect();
  };

  const focusResult = (index: number) => {
    const buttons = contentRef.current?.querySelectorAll<HTMLButtonElement>('[data-module-result]');
    if (buttons?.length) buttons[(index + buttons.length) % buttons.length]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openFinder}
        className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        {triggerLabel}
      </button>
      <Dialog open={open} onOpenChange={(next) => { if (!next) { restoreRef.current = null; setOpen(false); } }}>
        <DialogContent
          ref={contentRef}
          showCloseButton={false}
          className="max-h-[min(85dvh,44rem)] w-[calc(100vw-1.5rem)] gap-3 overflow-hidden rounded-xl p-4 sm:p-6"
          onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}
          onEscapeKeyDown={(event) => { event.preventDefault(); closeFromOwnedControl(); }}
          onKeyDown={(event) => {
            // Focus can arrive before Radix's layer priority has updated. Handle
            // only an unconsumed Escape from this dialog's own DOM in that gap.
            if (event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing || !(event.target instanceof Element) || event.target.closest('[role="dialog"]') !== event.currentTarget) return;
            event.preventDefault();
            closeFromOwnedControl();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const request = restoreRef.current;
            restoreRef.current = null;
            if (!request || !mountedRef.current || request.session !== sessionRef.current || !isChatbocSessionRevisionCurrent(request.revision) || !triggerRef.current?.isConnected) return;
            const active = document.activeElement;
            if (active === document.body || request.content.contains(active)) triggerRef.current.focus();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>Buscar módulo</DialogTitle>
              <DialogDescription className="mt-1">Elegí una herramienta de tu espacio de trabajo.</DialogDescription>
            </div>
            <button type="button" aria-label="Cerrar buscador" onClick={closeFromOwnedControl} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="text-sm font-medium">Nombre, grupo o descripción del módulo</label>
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault(); focusResult(event.key === 'ArrowDown' ? 0 : results.length - 1);
                } else if (event.key === 'Enter' && results.length === 1 && !event.nativeEvent.isComposing) {
                  event.preventDefault(); select(results[0].id);
                }
              }}
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <p role="status" className="text-sm text-muted-foreground">
            {results.length ? `${results.length} módulos disponibles` : 'No encontramos módulos con esa búsqueda.'}
          </p>
          <div className="min-h-0 space-y-1 overflow-y-auto overscroll-contain">
            {results.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  data-module-result
                  type="button"
                  aria-current={item.active ? 'page' : undefined}
                  onClick={() => select(item.id)}
                  onKeyDown={(event) => {
                    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    focusResult(event.key === 'Home' ? 0 : event.key === 'End' ? results.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1));
                  }}
                  className={cn('flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', item.active && 'bg-primary/10')}
                >
                  {Icon ? <Icon className="mt-0.5 h-5 w-5 shrink-0" /> : null}
                  <span className="min-w-0">
                    {item.group ? <span className="block text-xs text-muted-foreground">{item.group}</span> : null}
                    <span className="block text-sm font-semibold">{item.label}</span>
                    {item.description ? <span className="mt-0.5 block text-sm text-muted-foreground">{item.description}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
