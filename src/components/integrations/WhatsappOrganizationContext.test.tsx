import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Component, { type OrganizationSetupContext } from './WhatsappOrganizationContext';
const context: OrganizationSetupContext = {
  contract_version: 'whatsapp.self_service.v1', tenant: { slug: 'example' }, organization_label: 'Municipio',
  mode: 'existing_connection', heading: 'Continuá la configuración', description: 'Conservá tu conexión.',
  existing_connection: true, permissions_note: 'Requiere permisos.', verification_note: 'Verificar por separado.',
  sections: ['/perfil', '/implementacion', '/integracion', '/perfil/plantillas-respuesta'].map((path, id) => ({ id: String(id), label: `Opción ${id}`, description: 'Configuración existente', href: `/t/example${path}` })),
};
afterEach(cleanup);
describe('organization context navigation', () => {
  it('renders the server labels and four tenant-scoped routes', () => {
    render(<Component context={context} tenantSlug="example" />);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByText('Continuá la configuración')).toBeVisible();
  });
  it('does not show another tenant context', () => {
    render(<Component context={context} tenantSlug="other" />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
  it.each(['https://example.test', '/t/other/perfil', 'javascript:alert(1)'])('rejects an unexpected route %s', href => {
    render(<Component context={{ ...context, sections: [{ ...context.sections[0], href }, ...context.sections.slice(1)] }} tenantSlug="example" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
