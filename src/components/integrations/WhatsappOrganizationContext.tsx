import React from 'react';
import { ArrowRight, Building2, Link2 } from 'lucide-react';
import { buildTenantPath } from '@/utils/tenantPaths';
import styles from './WhatsappOrganizationContext.module.css';

export type OrganizationSetupContext = {
  contract_version: string; tenant: { slug: string; id?: string | number };
  organization_label: string; mode: string; heading: string; description: string;
  existing_connection: boolean; permissions_note: string; verification_note: string;
  sections: Array<{ id: string; label: string; href: string; description: string }>;
};
const paths = ['/perfil', '/implementacion', '/integracion', '/perfil/plantillas-respuesta'];

export default function WhatsappOrganizationContext({ context, tenantSlug }: {
  context?: OrganizationSetupContext | null; tenantSlug: string;
}) {
  if (!context || context.contract_version !== 'whatsapp.self_service.v1' || context.tenant?.slug !== tenantSlug
      || !Array.isArray(context.sections) || context.sections.length !== 4) return null;
  const allowed = new Set(paths.map(path => buildTenantPath(path, tenantSlug)));
  if (context.sections.some(item => !item || typeof item.label !== 'string' || typeof item.description !== 'string'
      || !allowed.has(item.href)) || new Set(context.sections.map(item => item.href)).size !== 4) return null;
  return (
    <section className={styles.context} aria-label="Configuración de la organización" data-testid="whatsapp-organization-context">
      <div className={styles.header}>
        <span className={styles.mark}><Building2 className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{context.organization_label}</p>
          <h4 className="mt-1 text-base font-semibold text-foreground">{context.heading}</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{context.description}</p>
        </div>
        {context.existing_connection === true ? <Link2 className="h-5 w-5 shrink-0 text-primary" aria-label="Conexión existente" /> : null}
      </div>
      <nav aria-label="Opciones de configuración" className={styles.links}>
        {context.sections.map(item => (
          <a className={styles.link} href={item.href} key={item.id}>
            <span className="min-w-0"><span className="font-semibold text-foreground">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          </a>
        ))}
      </nav>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{context.permissions_note}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{context.verification_note}</p>
    </section>
  );
}
