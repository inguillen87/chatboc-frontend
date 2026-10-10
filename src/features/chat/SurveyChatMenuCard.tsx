import React from 'react';
import { BarChart3, ExternalLink, Share2, Vote } from 'lucide-react';

import type { SurveyChatMenu, SurveyChatMenuItem } from './surveyChatMenu';

const PREVIEW_ITEM_LIMIT = 2;

const responseLabel = (item: SurveyChatMenuItem) => {
  if (typeof item.responseCount !== 'number') return null;
  return `${item.responseCount.toLocaleString('es-AR')} ${item.demoResponses ? 'respuestas demo' : 'respuestas'}`;
};

function SurveyItem({ item, compact = false }: { item: SurveyChatMenuItem; compact?: boolean }) {
  const Icon = item.type === 'voting' ? Vote : BarChart3;
  return (
    <li className="min-w-0 rounded-lg border border-border/80 bg-background/90 p-3 shadow-sm">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold leading-5 text-foreground">{item.title}</p>
            <span className="rounded-full border bg-muted/35 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.type === 'voting' ? 'Votación' : 'Encuesta'}
            </span>
          </div>
          {!compact && item.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
          ) : null}
          {responseLabel(item) ? (
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">{responseLabel(item)}</p>
          ) : null}
          <a
            href={item.publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={`Participar en ${item.title}`}
          >
            Participar <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </li>
  );
}

export default function SurveyChatMenuCard({ menu }: { menu: SurveyChatMenu }) {
  const featuredItems = menu.items.slice(0, PREVIEW_ITEM_LIMIT);
  const remainingItems = menu.items.slice(PREVIEW_ITEM_LIMIT);
  const shareableItems = menu.items.filter((item) => Boolean(item.whatsappShareUrl));
  const hiddenCount = remainingItems.length;
  const moreLabel = hiddenCount
    ? `Ver ${hiddenCount} ${hiddenCount === 1 ? 'encuesta más' : 'encuestas más'} y opciones para compartir`
    : 'Ver opciones para compartir';

  return (
    <section className="mt-2 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-background to-background p-3" aria-label="Encuestas y votaciones disponibles">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
          <Vote className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Participación ciudadana</p>
          <h3 className="mt-0.5 text-sm font-semibold leading-5 text-foreground">{menu.title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{menu.description}</p>
        </div>
      </div>

      <ul className="mt-3 grid list-none gap-2 p-0 sm:grid-cols-2" aria-label="Consultas destacadas">
        {featuredItems.map((item) => <SurveyItem key={item.id} item={item} />)}
      </ul>

      {(hiddenCount || shareableItems.length) ? (
        <details className="mt-2 rounded-lg border border-border/75 bg-background/75">
          <summary className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            {moreLabel}
          </summary>
          <div className="space-y-3 border-t border-border/70 p-3">
            {hiddenCount ? (
              <ul className="grid list-none gap-2 p-0 sm:grid-cols-2" aria-label="Más encuestas y votaciones">
                {remainingItems.map((item) => <SurveyItem key={item.id} item={item} compact />)}
              </ul>
            ) : null}
            {shareableItems.length ? (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Difusión
                </div>
                <div className="mt-2 flex flex-wrap gap-2" aria-label="Opciones para compartir">
                  {shareableItems.map((item) => (
                    <a
                      key={`share-${item.id}`}
                      href={item.whatsappShareUrl ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 max-w-full items-center rounded-md border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      aria-label={`Compartir ${item.title} por WhatsApp`}
                    >
                      <span className="truncate">Compartir {item.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {menu.totalAvailable > menu.items.length ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Mostrando {menu.items.length} de {menu.totalAvailable}. Usá “Ver más” para continuar.
        </p>
      ) : null}
    </section>
  );
}
