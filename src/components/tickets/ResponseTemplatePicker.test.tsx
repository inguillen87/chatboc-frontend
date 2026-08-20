import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResponseTemplate } from '@/features/tickets/responseTemplatesApi';

const pickerMocks = vi.hoisted(() => ({
  list: vi.fn(),
  preview: vi.fn(),
  suggest: vi.fn(),
}));

vi.mock('@/features/tickets/responseTemplatesApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/tickets/responseTemplatesApi')>(
    '@/features/tickets/responseTemplatesApi',
  );
  return {
    ...actual,
    listResponseTemplates: pickerMocks.list,
    previewResponseTemplateForTicket: pickerMocks.preview,
    suggestResponseTemplates: pickerMocks.suggest,
  };
});

import ResponseTemplatePicker from './ResponseTemplatePicker';

const tenantTemplate: ResponseTemplate = {
  id: 'tenant-1',
  tenantId: 7,
  tenantSlug: 'junin',
  scope: 'tenant',
  name: 'Caso asignado',
  text: 'El caso fue asignado al equipo operativo.',
  keywords: ['seguimiento'],
  isActive: true,
};

const globalTemplate: ResponseTemplate = {
  id: 'global-1',
  tenantId: null,
  tenantSlug: null,
  scope: 'global',
  name: 'Cierre institucional',
  text: 'Gracias por comunicarte con nuestro equipo.',
  keywords: ['cierre'],
  isActive: true,
};

const unresolvedTemplate: ResponseTemplate = {
  id: 'tenant-2',
  tenantId: 7,
  tenantSlug: 'junin',
  scope: 'tenant',
  name: 'Requiere datos',
  text: 'Hola {{nombre_cliente}}, tu caso es {{ticket_id}}.',
  keywords: [],
  isActive: true,
};

const renderPicker = (onSelectTemplate = vi.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Harness = () => {
    const [open, setOpen] = useState(false);
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <ResponseTemplatePicker
            open={open}
            onOpenChange={setOpen}
            onSelectTemplate={onSelectTemplate}
            tenantSlug="junin"
            ticketId={77}
            ticketKey="junin:TenantTicket:77"
            sourceModel="TenantTicket"
            metadata={{ category: 'alumbrado', status: 'en_proceso', channel: 'whatsapp' }}
            managementHref="/t/junin/perfil/plantillas-respuesta"
          >
            <button type="button">Abrir respuestas</button>
          </ResponseTemplatePicker>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  return render(<Harness />);
};

describe('ResponseTemplatePicker', () => {
  beforeEach(() => {
    pickerMocks.list.mockReset().mockResolvedValue([
      tenantTemplate,
      globalTemplate,
      unresolvedTemplate,
    ]);
    pickerMocks.suggest.mockReset().mockResolvedValue([{ ...tenantTemplate, score: 0.93 }]);
    pickerMocks.preview.mockReset().mockResolvedValue({
      renderedText: 'Respuesta validada por el servidor.',
      templateId: tenantTemplate.id,
      ticketId: 77,
      sourceModel: 'TenantTicket',
    });
  });

  it('groups contextual, organization and institutional templates from the backend catalog', async () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir respuestas' }));

    expect(await screen.findByText('Sugeridas para este caso')).toBeInTheDocument();
    expect(screen.getByText('De esta organización')).toBeInTheDocument();
    expect(screen.getByText('Base institucional')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Caso asignado/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Cierre institucional/ })).toBeInTheDocument();
    expect(pickerMocks.list).toHaveBeenCalledWith('junin');
    expect(pickerMocks.suggest).toHaveBeenCalledWith({
      tenantSlug: 'junin',
      metadata: { category: 'alumbrado', status: 'en_proceso', channel: 'whatsapp' },
    });
  });

  it('falls back to the full list when contextual suggestions fail', async () => {
    pickerMocks.suggest.mockRejectedValue(new Error('quota'));
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir respuestas' }));

    expect(await screen.findByRole('option', { name: /Caso asignado/ })).toBeInTheDocument();
    expect(
      await screen.findByText(/Las sugerencias contextuales no están disponibles ahora/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Cierre institucional/ })).toBeInTheDocument();
  });

  it('searches and inserts only the server-rendered active result with Enter', async () => {
    const onSelectTemplate = vi.fn();
    renderPicker(onSelectTemplate);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir respuestas' }));

    const search = await screen.findByRole('combobox', { name: 'Buscar respuestas rápidas' });
    fireEvent.change(search, { target: { value: 'cierre' } });
    expect(screen.queryByRole('option', { name: /Caso asignado/ })).not.toBeInTheDocument();
    fireEvent.keyDown(search, { key: 'Enter' });

    await waitFor(() =>
      expect(pickerMocks.preview).toHaveBeenCalledWith({
        tenantSlug: 'junin',
        templateId: globalTemplate.id,
        ticketId: 77,
        sourceModel: 'TenantTicket',
      }),
    );
    expect(onSelectTemplate).toHaveBeenCalledWith('Respuesta validada por el servidor.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('resolves template variables on the server before inserting', async () => {
    const onSelectTemplate = vi.fn();
    pickerMocks.preview.mockResolvedValue({
      renderedText: 'Hola Ana, tu caso es CRM-77.',
      templateId: unresolvedTemplate.id,
      ticketId: 77,
      sourceModel: 'TenantTicket',
    });
    renderPicker(onSelectTemplate);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir respuestas' }));

    fireEvent.click(await screen.findByRole('option', { name: /Requiere datos/ }));

    await waitFor(() => expect(onSelectTemplate).toHaveBeenCalledWith('Hola Ana, tu caso es CRM-77.'));
    expect(onSelectTemplate).not.toHaveBeenCalledWith(unresolvedTemplate.text);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows loading and stays fail-closed when the secure preview is rejected', async () => {
    const onSelectTemplate = vi.fn();
    let rejectPreview: ((reason: Error) => void) | null = null;
    pickerMocks.preview.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPreview = reject;
      }),
    );
    renderPicker(onSelectTemplate);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir respuestas' }));

    const option = await screen.findByRole('option', { name: /Requiere datos/ });
    fireEvent.click(option);

    expect(await screen.findByRole('status')).toHaveTextContent(/versión segura/i);
    expect(option).toBeDisabled();
    expect(onSelectTemplate).not.toHaveBeenCalled();

    rejectPreview?.(new Error('contract mismatch'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos preparar/i);
    expect(onSelectTemplate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes with Escape from the search field', async () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir respuestas' }));
    const search = await screen.findByRole('combobox', { name: 'Buscar respuestas rápidas' });

    fireEvent.keyDown(search, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
