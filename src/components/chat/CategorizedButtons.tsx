// src/components/chat/CategorizedButtons.tsx
import React, { useMemo } from 'react';
import { Categoria, SendPayload, Boton } from '@/types/chat';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { motion } from 'framer-motion';
import { openExternalLink } from '@/utils/openExternalLink';
import { useTenant } from '@/context/TenantContext';
import { buildTenantAwareUrl } from '@/utils/tenantUrls';
import { isDemoCatalogResourceUrl, normalizeDemoResourceUrl } from '@/utils/demoResourceUrls';

interface CategorizedButtonsProps {
  categorias: Categoria[];
  onButtonClick: (payload: SendPayload) => void;
  onInternalAction?: (action: string) => void;
}

// We need a simplified button handler here since ChatButtons is complex.
// Let's create a lean version for the accordion content.
const SimpleButton: React.FC<{ boton: Boton, onClick: (boton: Boton) => void, resolveUrl: (url?: string) => string | undefined }> = ({ boton, onClick, resolveUrl }) => {
    const baseClass = "rounded-xl px-3 py-1 text-sm font-semibold bg-white text-blue-800 border border-blue-200 hover:bg-blue-50 hover:shadow transition-all text-left";

    if (boton.url) {
        const resolvedUrl = resolveUrl(boton.url);
        return (
            <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                onClick={(event) => {
                    event.preventDefault();
                    if (resolvedUrl) {
                        openExternalLink(resolvedUrl);
                    }
                }}
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
  const { currentSlug } = useTenant();

  const resolveUrl = useMemo(
    () => (url?: string) => {
      const normalized = normalizeDemoResourceUrl(url);
      if (!normalized) return undefined;
      return isDemoCatalogResourceUrl(normalized)
        ? normalized
        : buildTenantAwareUrl(normalized, currentSlug);
    },
    [currentSlug],
  );

  if (!categorias || categorias.length === 0) {
    return null;
  }

  const handleButtonClick = (boton: Boton) => {
    const normalize = (v: string) => v.toLowerCase().replace(/[\s_-]+/g, "");
    const loginActions = ["login", "loginpanel", "chatuserloginpanel"].map(normalize);
    const registerActions = ["register", "registerpanel", "chatuserregisterpanel"].map(normalize);

    const actionToUse = boton.action || boton.action_id;
    const normalizedAction = actionToUse ? normalize(actionToUse) : null;
    const accionInterna = boton.accion_interna;
    const normalizedAccionInterna = accionInterna ? normalize(accionInterna) : null;

    if (normalizedAction && (loginActions.includes(normalizedAction) || registerActions.includes(normalizedAction))) {
        if (onInternalAction) onInternalAction(normalizedAction);
        return;
    }

    if (normalizedAccionInterna && (loginActions.includes(normalizedAccionInterna) || registerActions.includes(normalizedAccionInterna))) {
        if (onInternalAction) onInternalAction(normalizedAccionInterna);
        return;
    }

    if (actionToUse) {
      const actionId = boton.action_id || boton.action || undefined;
      onButtonClick({
        text: boton.texto,
        action: actionToUse,
        action_id: actionId,
        payload: boton.payload,
        source: 'button',
      });
      return;
    }

    if (accionInterna) {
      onButtonClick({ text: boton.texto, action: accionInterna, payload: boton.payload, source: 'button' });
      if (onInternalAction) onInternalAction(accionInterna);
      return;
    }

    if (boton.url) {
      const resolvedUrl = resolveUrl(boton.url);
      if (resolvedUrl) {
        openExternalLink(resolvedUrl);
      }
      return;
    }

    onButtonClick({ text: boton.texto, source: 'button' });
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
                            resolveUrl={resolveUrl}
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
