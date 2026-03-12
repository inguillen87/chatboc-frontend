import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { RealtimeHubResponse } from '@/services/analyticsService';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface Props {
  data: RealtimeHubResponse | null;
  loading?: boolean;
}

const RealtimeHubDashboard: React.FC<Props> = ({ data, loading }) => {
  const [selectedChannel, setSelectedChannel] = React.useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    try {
      const raw = safeLocalStorage.getItem('analytics_realtime_hub_filters');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.channel === 'string') setSelectedChannel(parsed.channel);
      if (typeof parsed?.sentiment === 'string') setSelectedSentiment(parsed.sentiment);
      if (typeof parsed?.search === 'string') setSearch(parsed.search);
    } catch {
      // no-op
    }
  }, []);

  React.useEffect(() => {
    safeLocalStorage.setItem('analytics_realtime_hub_filters', JSON.stringify({
      channel: selectedChannel,
      sentiment: selectedSentiment,
      search,
    }));
  }, [search, selectedChannel, selectedSentiment]);

  const totals = data?.totals || {};
  const topChannels = Array.isArray(data?.top_channels) ? data!.top_channels! : [];
  const topEvents = Array.isArray(data?.top_events) ? data!.top_events! : [];
  const recommendations = Array.isArray(data?.recommendations) ? data!.recommendations! : [];
  const comments = Array.isArray(data?.comments) ? data!.comments! : [];
  const hotspots = Array.isArray(data?.hotspots) ? data!.hotspots! : [];
  const sentiment = data?.sentiment || {};
  const channels = Array.from(new Set(comments.map((item) => item.channel).filter(Boolean))) as string[];
  const sentiments = Array.from(new Set(comments.map((item) => item.sentiment).filter(Boolean))) as string[];
  const filteredComments = comments.filter((item) => {
    if (selectedChannel !== 'all' && item.channel !== selectedChannel) return false;
    if (selectedSentiment !== 'all' && item.sentiment !== selectedSentiment) return false;
    if (search.trim() && !String(item.text || '').toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Cargando realtime hub…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-lg border bg-card p-3 md:grid-cols-4">
        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
          <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {channels.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedSentiment} onValueChange={setSelectedSentiment}>
          <SelectTrigger><SelectValue placeholder="Sentimiento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {sentiments.map((sentimentValue) => <SelectItem key={sentimentValue} value={sentimentValue}>{sentimentValue}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en comentarios" className="md:col-span-2" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Eventos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.events || 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Respuestas</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.survey_responses || 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Comentarios encuestas</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.survey_comments || 0}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Comentarios chat</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.live_chat_comments || 0}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Top canales</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {topChannels.length ? topChannels.map((item, idx) => (
              <div key={`ch_${idx}`} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{item.channel || '—'}</span>
                <span className="font-medium">{item.count || 0}</span>
              </div>
            )) : <p className="text-muted-foreground">Sin datos</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top eventos</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {topEvents.length ? topEvents.map((item, idx) => (
              <div key={`ev_${idx}`} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{item.event || '—'}</span>
                <span className="font-medium">{item.count || 0}</span>
              </div>
            )) : <p className="text-muted-foreground">Sin datos</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sentimiento</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.keys(sentiment).length ? Object.entries(sentiment).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{key}</span>
                <span className="font-medium">{value}</span>
              </div>
            )) : <p className="text-muted-foreground">Sin datos</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Comentarios en vivo</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {filteredComments.length ? filteredComments.slice(0, 12).map((item, idx) => (
              <div key={`cm_${idx}`} className="rounded border px-2 py-1">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.channel || '—'}</span>
                  <span>{item.sentiment || '—'}</span>
                </div>
                <p>{item.text || '—'}</p>
              </div>
            )) : <p className="text-muted-foreground">Sin resultados para filtros</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Hotspots + recomendaciones</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {hotspots.length ? hotspots.map((item, idx) => (
              <div key={`hs_${idx}`} className="flex items-center justify-between rounded border px-2 py-1">
                <span>{item.label || '—'}</span>
                <span className="font-medium">{item.count || 0}</span>
              </div>
            )) : <p className="text-muted-foreground">Sin hotspots</p>}
            {recommendations.length ? (
              <div className="pt-2">
                {recommendations.map((text, idx) => (
                  <div key={`rc_${idx}`} className="mb-1 rounded border bg-muted/30 px-2 py-1">{text}</div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealtimeHubDashboard;
