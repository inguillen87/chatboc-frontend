import React from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

export interface Rubro {
  id: number;
  nombre: string;
  subrubros?: Rubro[];
}

interface RubroSelectorProps {
  rubros: Rubro[];
  onSelect: (rubro: Rubro) => void;
}

const RubroSelector: React.FC<RubroSelectorProps> = ({ rubros, onSelect }) => {
  return (
    <Accordion type="multiple" className="w-full">
      {rubros.map((rubro) => (
        <AccordionItem key={rubro.id} value={String(rubro.id)}>
          <AccordionTrigger className="capitalize">{rubro.nombre}</AccordionTrigger>
          <AccordionContent>
            {Array.isArray(rubro.subrubros) && rubro.subrubros.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {rubro.subrubros.map((sub) => (
                  <motion.div key={sub.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="secondary"
                      className="rounded-xl shadow"
                      onClick={() => onSelect(sub)}
                    >
                      {sub.nombre}
                    </Button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="pt-2">
                <Button
                  variant="secondary"
                  className="rounded-xl shadow"
                  onClick={() => onSelect(rubro)}
                >
                  {rubro.nombre}
                </Button>
              </motion.div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default RubroSelector;
