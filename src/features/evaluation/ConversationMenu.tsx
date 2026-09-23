import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface ConversationMenuData {
  id: string; title: string; text: string; kind: string; source_pages: number[];
  actions: { code: string; label: string; target: string }[];
  source: { label: string; approval_status: string };
}

/** Shared read-only renderer; the server owns content and navigation targets. */
export default function ConversationMenu({ menu, busy, onChoose, headingRef }: {
  menu: ConversationMenuData; busy: boolean;
  onChoose: (node: string, selection: string) => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return <div className="evaluation-menu" data-node={menu.id}>
    <span className="evaluation-badge">{menu.kind === 'handoff' ? 'Derivación de prueba' : menu.kind === 'feedback' ? 'Cierre de prueba' : 'Orientación'}</span>
    <h2 ref={headingRef} tabIndex={-1}>{menu.title}</h2><p className="evaluation-message">{menu.text}</p>
    <div className="evaluation-options" aria-label="Opciones disponibles">{menu.actions.map(action => (
      <button type="button" key={action.code} disabled={busy} onClick={() => onChoose(menu.id, action.code)}>
        <span className="evaluation-code" aria-hidden="true">{action.code}</span><span>{action.label}</span><ChevronRight size={17} aria-hidden="true" />
      </button>
    ))}</div>
    <p className="evaluation-source">{menu.source.label} · páginas {menu.source_pages.join(', ')}. Contenido operativo sujeto a validación institucional.</p>
    <details className="evaluation-text-preview"><summary>Vista de texto para WhatsApp · sin envío</summary>
      <pre>{`${menu.title}\n\n${menu.text}\n\n${menu.actions.map(a => `${a.code}. ${a.label}`).join('\n')}`}</pre>
    </details>
  </div>;
}
