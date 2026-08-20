import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SeedButtonProps {
  onSeed: () => Promise<void>;
  loading?: boolean;
  surveyTitle?: string;
  labels?: {
    button?: string;
    buttonTitle?: string;
    dialogTitle?: string;
    dialogDescription?: string;
    confirmLabel?: string;
    loadingLabel?: string;
    cancelLabel?: string;
  };
}

export const SeedButton = ({ onSeed, loading = false, surveyTitle = '', labels }: SeedButtonProps) => {
  const [open, setOpen] = useState(false);
  const safeText = (value?: string) => (typeof value === 'string' ? value : '');
  const interpolate = (value?: string) =>
    typeof value === 'string' ? value.replace('{title}', surveyTitle) : '';

  const handleConfirm = async () => {
    try {
      await onSeed();
      setOpen(false);
    } catch (error) {
      console.error('Seed error:', error);
    }
  };

  const buttonText = safeText(labels?.button) || '100 Respuestas Demo';
  const buttonTitleText = safeText(labels?.buttonTitle) || 'Inyectar 100 respuestas sintéticas con geolocalización para demostraciones';

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          className="inline-flex items-center gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20 font-medium shadow-2xs"
          title={buttonTitleText}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          <span>{buttonText}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {safeText(labels?.dialogTitle) || 'Inyectar 100 respuestas sintéticas'}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-sm leading-relaxed">
            <span>
              {interpolate(labels?.dialogDescription) ||
                `Se generarán 100 respuestas realistas distribuidas por canales (WhatsApp, Web, QR) con georreferenciación (Ushuaia, Río Grande, Tolhuin / Junín), rangos de edad y opiniones para poblar el mapa de calor y analíticas de "${surveyTitle}".`}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{safeText(labels?.cancelLabel) || 'Cancelar'}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium inline-flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {safeText(labels?.loadingLabel) || 'Generando respuestas…'}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {safeText(labels?.confirmLabel) || 'Sembrar 100 respuestas'}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
