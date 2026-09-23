import React from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixtures from '../../../tests/fixtures/organization-workspaces.json';
import { readOrganizationWorkspace } from '@/utils/organizationWorkspace';
import InstitutionProfileWorkspace from './InstitutionProfileWorkspace';

afterEach(cleanup);
const callbacks = () => ({onCancel:vi.fn(),onSave:vi.fn(),onSectionChange:vi.fn()});
describe('shared organization profile presentation', () => {
  it.each(Object.entries(fixtures))('renders the declared vertical %s without granting edit access', (_, data) => {
    render(<InstitutionProfileWorkspace {...callbacks()} workspace={readOrganizationWorkspace(data,data.tenant.slug)}
      activeSection="general" institutionName="Organización sintética" isMunicipal={false} isAdministrator={false}>
      <input aria-label="Dato de prueba" />
    </InstitutionProfileWorkspace>);
    expect(screen.getByText(data.heading)).toBeVisible();
    expect(screen.getByText(data.organization_label,{exact:true})).toBeVisible();
    expect(screen.getByLabelText('Dato de prueba')).toBeDisabled();
    expect(screen.getByRole('button',{name:'Guardar'})).toBeDisabled();
    expect(screen.getByTestId('organization-profile-guidance')).toHaveTextContent(data.domain_note);
  });
  it('preserves navigation, renders continuity and delegates save without a second provisioning action', () => {
    const handlers=callbacks(); handlers.onSave.mockImplementation(event=>event.preventDefault());
    const data=fixtures.municipio;
    render(<InstitutionProfileWorkspace {...handlers} workspace={readOrganizationWorkspace(data,data.tenant.slug)}
      activeSection="channels" institutionName="Organización sintética" isMunicipal isAdministrator>
      <input aria-label="Dato de prueba" />
    </InstitutionProfileWorkspace>);
    expect(screen.getByTestId('organization-profile-guidance')).toHaveTextContent('Ya existe un registro de WhatsApp');
    fireEvent.click(screen.getByTestId('institution-profile-section-identity'));
    expect(handlers.onSectionChange).toHaveBeenCalledWith('identity');
    fireEvent.click(screen.getByRole('button',{name:'Guardar'}));
    expect(handlers.onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button',{name:/Crear cuenta|Reconectar/})).toBeNull();
  });
  it('has a neutral fallback instead of labeling every other organization as a business', () => {
    render(<InstitutionProfileWorkspace {...callbacks()} activeSection="general" institutionName="Sin tipo"
      isMunicipal={false} isAdministrator={false}><span>Contenido</span></InstitutionProfileWorkspace>);
    expect(screen.getByText('Organización',{exact:true})).toBeVisible();
    expect(screen.queryByText('Empresa',{exact:true})).toBeNull();
  });
});
