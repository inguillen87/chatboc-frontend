import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { parseAgendaText } from '@/utils/agendaParser';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { toast } from '@/components/ui/use-toast';

interface AgendaPasteFormProps {
  onCancel: () => void;
}

export const AgendaPasteForm: React.FC<AgendaPasteFormProps> = ({ onCancel }) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileName, setFileName] = useState('');

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
      await apiFetch('/municipal/posts/bulk', {
        method: 'POST',
        body: JSON.stringify(agenda),
        headers: { 'Content-Type': 'application/json' },
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
