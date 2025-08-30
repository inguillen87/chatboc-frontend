import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
