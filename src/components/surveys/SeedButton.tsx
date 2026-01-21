import { useState } from 'react';
import { Loader2, Sprout } from 'lucide-react';
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
}

export const SeedButton = ({ onSeed, loading = false, surveyTitle = 'esta encuesta' }: SeedButtonProps) => {
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      await onSeed();
      setOpen(false);
    } catch (error) {
      console.error('Seed error:', error);
      // Toast handling is done in the parent component
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          className="inline-flex items-center gap-2"
          title="Generar 100 respuestas de prueba"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sprout className="h-4 w-4 text-green-600" />
          )}
          <span className="hidden sm:inline">Seed 100</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Generar 100 respuestas de prueba?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción generará 100 respuestas aleatorias para <strong>{surveyTitle}</strong>.
            Esto es útil para visualizar datos en analytics, pero puede afectar las estadísticas reales.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              'Generar datos'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
