import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, Store, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface ContextualSurveyProps {
  question?: string;
  options?: { value: string; label: string; icon?: React.ReactNode }[];
  onAnswer?: (value: string) => void;
}

export const ContextualSurvey: React.FC<ContextualSurveyProps> = ({
  question = "¿Cómo preferís recibir tus pedidos?",
  options = [
    { value: 'delivery', label: 'Envío a domicilio (24hs)', icon: <Truck className="h-4 w-4" /> },
    { value: 'pickup', label: 'Retiro en local inmediato', icon: <Store className="h-4 w-4" /> },
    { value: 'point', label: 'Punto de retiro cercano', icon: <MapPin className="h-4 w-4" /> },
  ]
}) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!selected) return;
    setSubmitted(true);
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Ayudanos a mejorar</CardTitle>
      </CardHeader>
      <CardContent>
        {!submitted ? (
          <div className="space-y-4">
            <h3 className="font-medium">{question}</h3>
            <RadioGroup onValueChange={setSelected} className="space-y-2">
              {options.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <RadioGroupItem value={opt.value} id={opt.value} />
                  <Label htmlFor={opt.value} className="flex-1 flex items-center gap-2 cursor-pointer">
                    {opt.icon}
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <Button
              className="w-full"
              disabled={!selected}
              onClick={handleSubmit}
            >
              Enviar Respuesta
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-3">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-bold text-lg text-primary">¡Gracias!</h3>
            <p className="text-muted-foreground mt-1">
              Tomamos en cuenta tu preferencia para futuros envíos.
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
