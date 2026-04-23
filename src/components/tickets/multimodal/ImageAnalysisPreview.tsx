import React from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ImageAnalysisPreviewProps {
  imageUrl: string;
  suggestedTitle: string;
  suggestedDescription: string;
  confidence: number;
  onConfirm: (title: string, desc: string) => void;
  onCancel: () => void;
}

export const ImageAnalysisPreview: React.FC<ImageAnalysisPreviewProps> = ({
  imageUrl, suggestedTitle, suggestedDescription, confidence, onConfirm, onCancel
}) => {
  const [title, setTitle] = React.useState(suggestedTitle);
  const [desc, setDesc] = React.useState(suggestedDescription);

  return (
    <div className="flex flex-col gap-4 w-full border rounded-lg p-4 bg-card shadow-sm">
      <div className="flex gap-4">
         <div className="w-1/3 shrink-0 rounded-md overflow-hidden border bg-black/5 aspect-square relative">
            <img src={imageUrl} alt="Análisis" className="object-cover w-full h-full" />
            <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-medium shadow-sm border">
               Confianza IA: {(confidence * 100).toFixed(0)}%
            </div>
         </div>
         <div className="w-2/3 flex flex-col gap-3">
            <div className="space-y-1.5">
               <Label className="text-xs text-muted-foreground">Título sugerido</Label>
               <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
               <Label className="text-xs text-muted-foreground">Descripción detectada</Label>
               <Textarea value={desc} onChange={e => setDesc(e.target.value)} className="min-h-[80px] resize-none text-sm" />
            </div>
         </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t">
         <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 text-muted-foreground">
            <X className="w-3.5 h-3.5 mr-1" /> Descartar
         </Button>
         <Button size="sm" onClick={() => onConfirm(title, desc)} className="h-8">
            <Check className="w-3.5 h-3.5 mr-1" /> Confirmar Creación
         </Button>
      </div>
    </div>
  );
};
