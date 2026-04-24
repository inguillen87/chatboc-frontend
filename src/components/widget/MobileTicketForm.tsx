import React, { useState } from 'react';
import { Camera, MapPin, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageUploadDropzone, ImageAnalysisPreview, PIIWarningBanner } from '../tickets/multimodal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface MobileTicketFormProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const MobileTicketForm: React.FC<MobileTicketFormProps> = ({ onClose, onSubmit }) => {
  const [step, setStep] = useState<'upload' | 'analysis' | 'form' | 'success'>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStep('analysis');
    // Mock fast analysis flow
    setTimeout(() => {
       setTitle("Bache reportado");
       setDesc("Se observan daños en el asfalto que requieren reparación vial.");
    }, 1500);
  };

  const handleAnalysisConfirm = (newTitle: string, newDesc: string) => {
    setTitle(newTitle);
    setDesc(newDesc);
    setStep('form');
  };

  const handleLocationRequest = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation(pos.coords),
        (err) => alert("No pudimos obtener la ubicación. Puedes escribirla manualmente.")
      );
    }
  };

  const handleSubmit = () => {
    // In a real flow, upload the image to storage, then POST ticket
    onSubmit({ title, description: desc, location: location ? { lat: location.latitude, lng: location.longitude } : null });
    setStep('success');
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center h-14 border-b px-4 shrink-0 bg-card">
         <Button variant="ghost" size="icon" onClick={onClose} className="mr-2 -ml-2 text-muted-foreground">
           <ArrowLeft className="w-5 h-5" />
         </Button>
         <h2 className="font-semibold text-base">Crear Reclamo</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {step === 'upload' && (
          <div className="flex flex-col gap-4 h-full pt-4">
             <PIIWarningBanner />
             <div className="mt-4">
                <ImageUploadDropzone onImageAccepted={handleImageSelect} />
             </div>
             <Button variant="outline" className="w-full gap-2 mt-auto" onClick={() => setStep('form')}>
                Saltar foto y continuar manual
             </Button>
          </div>
        )}

        {step === 'analysis' && previewUrl && (
          <ImageAnalysisPreview
             imageUrl={previewUrl}
             suggestedTitle={title}
             suggestedDescription={desc}
             confidence={0.92}
             onConfirm={handleAnalysisConfirm}
             onCancel={() => { setImageFile(null); setPreviewUrl(null); setStep('upload'); }}
          />
        )}

        {step === 'form' && (
          <div className="flex flex-col gap-5">
             {previewUrl && (
               <img src={previewUrl} alt="Adjunto" className="w-24 h-24 object-cover rounded-md border" />
             )}

             <div className="space-y-2">
                <label className="text-sm font-medium">Asunto del reclamo</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Luminaria rota en calle principal" />
             </div>

             <div className="space-y-2">
                <label className="text-sm font-medium">Descripción detallada</label>
                <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brinda más información..." className="min-h-[100px]" />
             </div>

             <div className="space-y-2">
                <label className="text-sm font-medium">Ubicación</label>
                {location ? (
                  <div className="p-3 border rounded-md bg-green-50 text-green-800 text-sm flex items-center gap-2">
                     <MapPin className="w-4 h-4" /> Ubicación capturada
                  </div>
                ) : (
                  <Button variant="secondary" className="w-full gap-2" onClick={handleLocationRequest}>
                     <MapPin className="w-4 h-4" /> Compartir mi ubicación actual
                  </Button>
                )}
             </div>

             <Button className="w-full mt-4 h-12 text-base font-semibold" onClick={handleSubmit}>
                Enviar Reclamo
             </Button>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center text-center h-full gap-4 pb-20">
             <CheckCircle className="w-16 h-16 text-green-500" />
             <div>
                <h3 className="text-lg font-bold">¡Reclamo enviado!</h3>
                <p className="text-muted-foreground mt-2 max-w-xs">
                   El ticket fue registrado exitosamente. Te notificaremos los avances por este medio.
                </p>
             </div>
             <Button variant="outline" className="mt-4" onClick={onClose}>Volver al chat</Button>
          </div>
        )}
      </div>
    </div>
  );
};
