import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ClerkTenantOnboardingDialog from './ClerkTenantOnboardingDialog';

const renderDialog = (props: Partial<React.ComponentProps<typeof ClerkTenantOnboardingDialog>> = {}) => {
  const onOpenChange = props.onOpenChange || vi.fn();
  const onSubmit = props.onSubmit || vi.fn();

  render(
    <ClerkTenantOnboardingDialog
      open
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      {...props}
    />,
  );

  return { onOpenChange, onSubmit };
};

describe('ClerkTenantOnboardingDialog', () => {
  it('keeps mandatory tenant onboarding from being dismissed', () => {
    renderDialog({ required: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear tenant/i })).toBeInTheDocument();
  });

  it('keeps the normal close affordance when onboarding is optional', () => {
    const { onOpenChange } = renderDialog({ required: false });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('uses the backend onboarding contract to prefill and submit vertical setup', async () => {
    const { onSubmit } = renderDialog({
      defaultTenantName: 'Ferreteria Modelo',
      onboarding: {
        required: true,
        title: 'Completa tu espacio Chatboc',
        description: 'Setup guiado por rubro.',
        modal: {
          summary_cards: [{ id: 'workspace', label: 'Tenant y CRM', description: 'Listo para operar.' }],
          starter_modules: [
            { id: 'crm_operativo', label: 'CRM operativo', description: 'Tickets y pedidos.' },
            { id: 'marketplace_catalogo', label: 'Catalogo / marketplace', description: 'Productos y promos.' },
          ],
          vertical_options: [{ value: 'pyme', label: 'Empresa / comercio' }],
          goal_options: [{ value: 'ventas', label: 'Vender y tomar pedidos' }],
          vertical_presets: {
            pyme: {
              rubro: 'ventas y atencion',
              primary_goal: 'ventas',
              preferred_channels: ['whatsapp', 'webchat', 'instagram'],
              headline: 'Ventas, pedidos, catalogo y promociones',
              recommended_modules: ['crm_operativo', 'marketplace_catalogo'],
              starter_questions: ['Que productos se venden por WhatsApp?'],
            },
          },
        },
      },
    });

    expect(await screen.findByText('Ventas, pedidos, catalogo y promociones')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByDisplayValue('Ferreteria Modelo')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue('ventas y atencion')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /crear tenant/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_name: 'Ferreteria Modelo',
        vertical: 'pyme',
        rubro: 'ventas y atencion',
        primary_goal: 'ventas',
        preferred_channels: ['whatsapp', 'webchat', 'instagram'],
      }),
    );
  });

  it('shows the WhatsApp full-plan requirement from the backend contract', () => {
    renderDialog({
      onboarding: {
        required: true,
        title: 'Completa tu espacio Chatboc',
        description: 'Setup guiado por rubro.',
        modal: {
          whatsapp_business_requirements: {
            production_enabled_by_default: false,
            required_plan: 'full',
            required_provider_setup: ['meta_business', 'twilio_whatsapp_sender'],
            free_plan_state: 'created_without_waba_provisioning',
            message:
              'El tenant se crea en modo free. WhatsApp productivo y creacion real de plantillas se activan con plan Full y sender Meta/Twilio configurado.',
          },
        },
      },
    });

    expect(screen.getByTestId('clerk-whatsapp-requirements')).toHaveTextContent('WhatsApp productivo');
    expect(screen.getByTestId('clerk-whatsapp-requirements')).toHaveTextContent('plan Full');
    expect(screen.getByTestId('clerk-whatsapp-requirements')).toHaveTextContent('Plan full');
    expect(screen.getByTestId('clerk-whatsapp-requirements')).toHaveTextContent('meta business');
    expect(screen.getByTestId('clerk-whatsapp-requirements')).toHaveTextContent('twilio whatsapp sender');
  });

  it('shows self-service plan policy without submitting a productive plan', async () => {
    const { onSubmit } = renderDialog({
      defaultTenantName: 'Municipalidad Demo',
      onboarding: {
        required: true,
        title: 'Completa tu espacio Chatboc',
        description: 'Setup guiado por rubro.',
        modal: {
          plan_policy: {
            self_service_plan: 'free',
            requested_plan_allowed: false,
            productive_plan: 'full',
            upgrade_requires: 'superadmin_or_commercial_approval',
            message:
              'El registro publico siempre crea un espacio Free. El plan Full se solicita para revision comercial y solo se concede desde administracion.',
          },
          vertical_presets: {
            pyme: {
              rubro: 'ventas',
              primary_goal: 'ventas',
              preferred_channels: ['whatsapp', 'webchat'],
            },
          },
        },
      },
    });

    expect(screen.getByTestId('clerk-plan-policy')).toHaveTextContent('Plan inicial seguro');
    expect(screen.getByTestId('clerk-plan-policy')).toHaveTextContent('Alta free');
    expect(screen.getByTestId('clerk-plan-policy')).toHaveTextContent('Productivo full');
    await waitFor(() => expect(screen.getByDisplayValue('Municipalidad Demo')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /crear tenant/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.not.objectContaining({
        plan: expect.anything(),
      }),
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_name: 'Municipalidad Demo',
        preferred_channels: ['whatsapp', 'webchat'],
      }),
    );
  });
});
