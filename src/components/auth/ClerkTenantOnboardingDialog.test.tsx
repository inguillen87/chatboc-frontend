import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ClerkTenantOnboardingDialog from './ClerkTenantOnboardingDialog';

vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const renderDialog = (props: Partial<React.ComponentProps<typeof ClerkTenantOnboardingDialog>> = {}) => {
  const onOpenChange = props.onOpenChange || vi.fn();
  const onSubmit = props.onSubmit || vi.fn();

  render(<ClerkTenantOnboardingDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} {...props} />);

  return { onOpenChange, onSubmit };
};

describe('ClerkTenantOnboardingDialog', () => {
  it('keeps one bounded scroll region while the footer CTA remains reachable on mobile and desktop', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    const scrollRegion = screen.getByTestId('clerk-onboarding-scroll-region');
    const footer = screen.getByTestId('clerk-onboarding-footer');
    const submit = screen.getByRole('button', { name: /crear tenant/i });

    expect(dialog).toHaveClass(
      'flex',
      'flex-col',
      'overflow-hidden',
      'max-h-[calc(100dvh-1rem)]',
      'w-[calc(100%-1rem)]',
      'sm:max-h-[calc(100dvh-2rem)]',
      'sm:w-[calc(100%-2rem)]',
    );
    expect(scrollRegion).toHaveClass('min-h-0', 'flex-1', 'overflow-x-hidden', 'overflow-y-auto', 'overscroll-contain', '[scrollbar-gutter:stable]');
    expect(footer).toHaveClass('shrink-0');
    expect(scrollRegion).not.toContainElement(footer);
    expect(footer).toContainElement(submit);
    expect(submit).toHaveClass('min-h-11', 'w-full', 'sm:w-auto');
  });

  it('resets the draft and consent when the Clerk user id or primary email changes', async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    const renderForIdentity = (userProfile: NonNullable<React.ComponentProps<typeof ClerkTenantOnboardingDialog>['userProfile']>) => (
      <ClerkTenantOnboardingDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} defaultTenantName="Organizacion Clerk" userProfile={userProfile} />
    );
    const firstIdentity = {
      id: 'user_a',
      primary_email_address_id: 'email_primary',
      email_addresses: [{ id: 'email_primary', email_address: 'owner-a@example.com' }],
    };
    const { rerender } = render(renderForIdentity(firstIdentity));

    const tenantName = await screen.findByLabelText(/Nombre de organizacion/i);
    const rubro = screen.getByLabelText(/Rubro/i);
    const consent = screen.getByRole('checkbox');
    await waitFor(() => expect(tenantName).toHaveValue('Organizacion Clerk'));

    fireEvent.change(tenantName, {
      target: { value: 'Borrador de otra persona' },
    });
    fireEvent.change(rubro, { target: { value: 'Rubro privado' } });
    fireEvent.click(consent);

    rerender(
      renderForIdentity({
        ...firstIdentity,
        id: 'user_b',
        email_addresses: [{ id: 'email_primary', email_address: 'owner-b@example.com' }],
      }),
    );

    await waitFor(() => expect(tenantName).toHaveValue('Organizacion Clerk'));
    expect(rubro).toHaveValue('');
    expect(consent).not.toBeChecked();

    fireEvent.change(tenantName, {
      target: { value: 'Segundo borrador privado' },
    });
    fireEvent.change(rubro, { target: { value: 'Segundo rubro privado' } });
    fireEvent.click(consent);

    rerender(
      renderForIdentity({
        ...firstIdentity,
        id: 'user_b',
        email_addresses: [{ id: 'email_primary', email_address: 'new-owner-b@example.com' }],
      }),
    );

    await waitFor(() => expect(tenantName).toHaveValue('Organizacion Clerk'));
    expect(rubro).toHaveValue('');
    expect(consent).not.toBeChecked();
  });

  it('labels custom selects and moves focus to an announced backend error', async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(<ClerkTenantOnboardingDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />);

    const tenantName = screen.getByLabelText(/Nombre de organizacion/i);
    expect(screen.getByLabelText('Vertical')).toHaveAttribute('id', 'clerk-onboarding-vertical');
    expect(screen.getByLabelText('Objetivo principal')).toHaveAttribute('id', 'clerk-onboarding-primary-goal');
    await waitFor(() => expect(tenantName).toHaveFocus());

    rerender(<ClerkTenantOnboardingDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} error="No se pudo crear el tenant." />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByRole('button', { name: /crear tenant/i })).toHaveAttribute('aria-describedby', 'clerk-onboarding-error');
    await waitFor(() => expect(alert).toHaveFocus());
  });

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
          summary_cards: [
            {
              id: 'workspace',
              label: 'Tenant y CRM',
              description: 'Listo para operar.',
            },
          ],
          starter_modules: [
            {
              id: 'crm_operativo',
              label: 'CRM operativo',
              description: 'Tickets y pedidos.',
            },
            {
              id: 'marketplace_catalogo',
              label: 'Catalogo / marketplace',
              description: 'Productos y promos.',
            },
          ],
          vertical_options: [{ value: 'pyme', label: 'Empresa / comercio' }],
          goal_options: [{ value: 'ventas', label: 'Vender y tomar pedidos' }],
          terms: {
            required: true,
            version: '2026-07-11',
            terms_url: '/terminos',
            privacy_url: '/privacidad',
            label: 'Acepto los Terminos y la Politica de Privacidad',
          },
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

    expect(screen.getByRole('button', { name: /crear tenant/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /crear tenant/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_name: 'Ferreteria Modelo',
        vertical: 'pyme',
        rubro: 'ventas y atencion',
        primary_goal: 'ventas',
        preferred_channels: ['whatsapp', 'webchat', 'instagram'],
        terms_accepted: true,
        terms_version: '2026-07-11',
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

    fireEvent.click(screen.getByRole('checkbox'));
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

  it('shows a focused consent renewal for an existing tenant', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      onSubmit,
      onboarding: {
        required: true,
        status: 'terms_pending',
        title: 'Actualiza tu consentimiento',
        modal: {
          mode: 'terms_only',
          existing_tenant: {
            id: 7,
            slug: 'junin',
            nombre: 'Municipalidad de Junin',
          },
          terms: {
            required: true,
            version: '2026-08-01',
            terms_url: '/terminos',
            privacy_url: '/privacidad',
          },
        },
      },
      required: true,
    });

    expect(screen.getByText('Municipalidad de Junin')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nombre de organizacion/i)).not.toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /Aceptar y continuar/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(submit);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_name: 'Municipalidad de Junin',
          terms_accepted: true,
          terms_version: '2026-08-01',
        }),
      );
    });
  });
});
