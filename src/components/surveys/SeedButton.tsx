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
          title={safeText(labels?.buttonTitle)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sprout className="h-4 w-4 text-green-600" />
          )}
          <span className="hidden sm:inline">{safeText(labels?.button)}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
        <AlertDialogTitle>{safeText(labels?.dialogTitle)}</AlertDialogTitle>
        <AlertDialogDescription>{interpolate(labels?.dialogDescription)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{safeText(labels?.cancelLabel)}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {safeText(labels?.loadingLabel)}
              </>
            ) : (
              safeText(labels?.confirmLabel)
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
