import React, { useState, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { parseAgendaText, type Agenda } from '@/utils/agendaParser';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { toast } from '@/components/ui/use-toast';
import {
  buildAgendaEventContent,
  createAgendaDateContext,
  parseDateTimeValue,
  resolveDayDate,
} from '@/utils/agendaDateUtils';
import { toLocalISOString } from '@/utils/fecha';

interface AgendaPasteFormProps {
  onCancel: () => void;
}

export const AgendaPasteForm: React.FC<AgendaPasteFormProps> = ({ onCancel }) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileName, setFileName] = useState('');

  const parsedAgenda = useMemo<Agenda | null>(() => {
    if (!text.trim()) return null;
    try {
      return parseAgendaText(text);
    } catch {
      return null;
    }
  }, [text]);

  async function handleFile(file: File) {
    setFileName(file.name);
    try {
      let content = '';
      if (file.name.toLowerCase().endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else {
        content = await file.text();
      }
      setText(content);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al leer el archivo',
        description: getErrorMessage(error, 'No se pudo leer el archivo. Usa un .txt o .docx válido.'),
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const agenda = parseAgendaText(text);
      const dateContext = createAgendaDateContext(agenda.title);
      const events = agenda.days.flatMap((day) => {
        const baseDate = resolveDayDate(day.day, dateContext);

        return day.events
          .map((ev) => {
            const startDate = parseDateTimeValue(ev.startTime, baseDate, dateContext);
            const endDate = parseDateTimeValue(ev.endTime, startDate ?? baseDate, dateContext);
            const contenido = buildAgendaEventContent(day.day, ev, startDate, endDate);

            return {
              title: ev.title,
              titulo: ev.title,
              day: day.day,
              start_time: ev.startTime,
              end_time: ev.endTime,
              location: ev.location,
              direccion: ev.location || undefined,
              link: ev.link,
              image: ev.image,
              imagen_url: ev.image || undefined,
              tipo_post: 'evento',
              contenido,
              fecha_evento_inicio: startDate ? toLocalISOString(startDate) : undefined,
              fecha_evento_fin: endDate ? toLocalISOString(endDate) : undefined,
            };
          })
          .filter((event) => event.title.trim().length > 0);
      });

      if (events.length === 0) {
        throw new Error('No se encontraron eventos válidos para publicar.');
      }
      await apiFetch('/municipal/posts/bulk', {
        method: 'POST',
        body: { events },
      });
      toast({ title: 'Éxito', description: 'La agenda ha sido procesada correctamente.' });
      onCancel();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al procesar la agenda',
        description: getErrorMessage(error, 'No se pudo procesar la agenda. Intenta de nuevo.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="file"
        accept=".txt,.docx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFile(file);
          }
        }}
      />
      {fileName && (
        <p className="text-sm text-muted-foreground">Archivo: {fileName}</p>
      )}
      <Textarea
        placeholder="Pega aquí el texto completo de la agenda..."
        className="min-h-[300px] resize-y"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {parsedAgenda && parsedAgenda.days.length > 0 && (
        <div className="max-h-60 overflow-y-auto rounded-md border p-4 text-sm">
          <p className="mb-2 font-semibold">{parsedAgenda.title}</p>
          {parsedAgenda.days.map((day, idx) => (
            <div key={idx} className="mb-2">
              <p className="font-medium">{day.day}</p>
              <ul className="ml-4 list-disc">
                {day.events.map((ev, i) => (
                  <li key={i} className="mb-1">
                    {ev.startTime && (
                      <span className="font-medium">
                        {ev.startTime}
                        {ev.endTime ? ` - ${ev.endTime}` : ''}{' '}
                      </span>
                    )}
                    {ev.title}
                    {ev.location && <span className="text-muted-foreground"> - {ev.location}</span>}
                    {ev.link && (
                      <div className="ml-4 break-all text-muted-foreground">{ev.link}</div>
                    )}
                    {ev.image && (
                      <div className="ml-4 break-all text-muted-foreground">{ev.image}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || !text.trim()}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
            </>
          ) : (
            'Procesar Agenda'
          )}
        </Button>
      </div>
    </form>
  );
};

export default AgendaPasteForm;
