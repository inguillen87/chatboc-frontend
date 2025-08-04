// src/components/chat/CategorizedButtons.tsx
import React from 'react';
import { Categoria, SendPayload, Boton } from '@/types/chat';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { motion } from 'framer-motion';

interface CategorizedButtonsProps {
  categorias: Categoria[];
  onButtonClick: (payload: SendPayload) => void;
  onInternalAction?: (action: string) => void;
}

// We need a simplified button handler here since ChatButtons is complex.
// Let's create a lean version for the accordion content.
const SimpleButton: React.FC<{ boton: Boton, onClick: (boton: Boton) => void }> = ({ boton, onClick }) => {
    const baseClass = "rounded-xl px-3 py-1 text-sm font-semibold bg-white text-blue-800 border border-blue-200 hover:bg-blue-50 hover:shadow transition-all text-left";

    if (boton.url) {
        return (
            <a
                href={boton.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${baseClass} no-underline inline-block w-full`}
                title={boton.texto}
            >
                {boton.texto}
            </a>
        );
    }

    return (
        <button
            onClick={() => onClick(boton)}
            className={`${baseClass} w-full`}
            title={boton.texto}
        >
            {boton.texto}
        </button>
    );
};


const CategorizedButtons: React.FC<CategorizedButtonsProps> = ({
  categorias,
  onButtonClick,
  onInternalAction,
}) => {
  if (!categorias || categorias.length === 0) {
    return null;
  }

  const handleButtonClick = (boton: Boton) => {
    const normalize = (v: string) => v.toLowerCase().replace(/[\s_-]+/g, "");
    const loginActions = ["login", "loginpanel", "chatuserloginpanel"].map(normalize);
    const registerActions = ["register", "registerpanel", "chatuserregisterpanel"].map(normalize);

    const action = boton.action || boton.accion_interna;
    const normalizedAction = action ? normalize(action) : null;

    if (normalizedAction && (loginActions.includes(normalizedAction) || registerActions.includes(normalizedAction))) {
        if (onInternalAction) onInternalAction(normalizedAction);
        return;
    }

    if (action) {
      onButtonClick({ text: boton.texto, action: action });
      if (onInternalAction) onInternalAction(action);
      return;
    }

    if (boton.url) {
      window.open(boton.url, "_blank", "noopener,noreferrer");
      return;
    }

    onButtonClick({ text: boton.texto });
  };

  return (
    <motion.div
      className="w-full mt-2"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Accordion type="multiple" className="w-full">
        {categorias.map((categoria, index) => (
          <AccordionItem value={`cat-${index}`} key={index}>
            <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
              {categoria.titulo}
            </AccordionTrigger>
            <AccordionContent>
                <div className="flex flex-col gap-2 pt-1">
                    {categoria.botones.map((boton, btnIndex) => (
                        <SimpleButton
                            key={btnIndex}
                            boton={boton}
                            onClick={handleButtonClick}
                        />
                    ))}
                </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </motion.div>
  );
};

export default CategorizedButtons;
