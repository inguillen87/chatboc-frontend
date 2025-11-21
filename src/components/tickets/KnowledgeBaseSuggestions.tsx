import React, { useEffect, useMemo, useState } from 'react';
import { Lightbulb, Loader2, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Ticket, Message } from '@/types/tickets';
import {
  KnowledgeBaseSuggestion,
  buildFaqFallbackSuggestions,
  fetchKnowledgeBaseSuggestions,
} from '@/services/knowledgeBaseService';
import { getTicketChannel } from '@/utils/ticket';
import { useTenant } from '@/context/TenantContext';

interface Props {
  ticket: Ticket;
  messages: Message[];
  language?: string;
}

const formatConfidence = (confidence?: number) => {
  if (typeof confidence !== 'number') return null;
  const value = Math.min(Math.max(confidence, 0), 1);
  return `${Math.round(value * 100)}%`;
};

const buildQuery = (ticket: Ticket, messages: Message[]): string => {
  const parts: string[] = [];
  if (ticket.asunto) parts.push(ticket.asunto);
  if (ticket.categoria) parts.push(ticket.categoria);
  const lastUserMessage = [...messages]
    .reverse()
    .find((msg) => msg.author === 'user' && msg.content?.trim());
  if (lastUserMessage?.content) parts.push(lastUserMessage.content);
  if (!parts.length && ticket.description) parts.push(ticket.description);
  return parts.join(' • ');
};

export default function KnowledgeBaseSuggestions({ ticket, messages, language }: Props) {
  const tenant = useTenant();
  const [suggestions, setSuggestions] = useState<KnowledgeBaseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo(() => buildQuery(ticket, messages), [ticket, messages]);
  const channelLabel = useMemo(() => getTicketChannel(ticket), [ticket]);

  const loadSuggestions = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const remote = await fetchKnowledgeBaseSuggestions({
        ticketId: ticket.id,
        query,
        tenantSlug: tenant?.slug || null,
        language: language || null,
      });
      if (remote.length) {
        setSuggestions(remote);
        return;
      }
      setSuggestions(buildFaqFallbackSuggestions(query));
    } catch (err) {
      console.error('Unable to load suggestions', err);
      setError('No se pudieron obtener sugerencias automáticas en este momento.');
      setSuggestions(buildFaqFallbackSuggestions(query));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, language]);

  if (!query) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Respuestas sugeridas
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Recomendaciones generadas según el canal {channelLabel} y el contexto del reclamo.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={loadSuggestions}
          disabled={loading}
          aria-label="Actualizar sugerencias"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading && !suggestions.length ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando coincidencias en la base de conocimiento...
          </div>
        ) : null}
        {!loading && !suggestions.length ? (
          <p className="text-sm text-muted-foreground">
            No encontramos respuestas automáticas para este caso todavía.
          </p>
        ) : null}
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.title || 'suggestion'}-${index}`}
              className="rounded-lg border bg-muted/40 p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  {suggestion.title && (
                    <p className="text-sm font-semibold leading-tight text-foreground break-words">
                      {suggestion.title}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line break-words">
                    {suggestion.answer}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {suggestion.source && (
                    <Badge variant="secondary" className="text-xs">
                      {suggestion.source}
                    </Badge>
                  )}
                  {formatConfidence(suggestion.confidence) && (
                    <Badge variant="outline" className="text-xs font-medium">
                      {formatConfidence(suggestion.confidence)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
