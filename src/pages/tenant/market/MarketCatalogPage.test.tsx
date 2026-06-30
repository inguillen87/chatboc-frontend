import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MarketCatalogPage from './MarketCatalogPage';

const fetchMarketCatalogMock = vi.fn();
const fetchMarketCartMock = vi.fn();
const addMarketItemMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ tenant: 'junin' }),
  };
});

vi.mock('@/api/market', () => ({
  fetchMarketCatalog: (...args: unknown[]) => fetchMarketCatalogMock(...args),
  fetchMarketCart: (...args: unknown[]) => fetchMarketCartMock(...args),
  addMarketItem: (...args: unknown[]) => addMarketItemMock(...args),
}));

describe('MarketCatalogPage assisted marketplace entry', () => {
  beforeEach(() => {
    fetchMarketCatalogMock.mockReset();
    fetchMarketCartMock.mockReset();
    addMarketItemMock.mockReset();
    fetchMarketCartMock.mockResolvedValue({ items: [], totalAmount: 0, totalPoints: 0 });
    fetchMarketCatalogMock.mockResolvedValue({
      products: [],
      promotions: { items: [] },
      facets: { categories: [], promotion_count: 0 },
      sort_options: [],
      total: 0,
      total_unfiltered: 0,
      heroSubtitle: 'Catalogo actualizado con promociones y disponibilidad operativa.',
      assisted_intake: {
        contract_version: 'marketplace.assisted_intake_entry.v1',
        title: 'Subi boletas, certificados, pedidos o notas y el municipio lo toma desde el CRM',
        summary: 'Contrato de intake asistido para vecinos sin registro.',
        input_examples: ['Boleta de tasa municipal o comprobante', 'Foto de una nota del vecino'],
        text_examples: [
          {
            id: 'gov_tax_bill',
            label: 'Boleta municipal',
            document_type: 'tax_bill',
            text: 'Boleta de tasa municipal cuenta 9988',
          },
        ],
        pipeline: [
          { id: 'capture', label: 'Foto, PDF o texto', description: 'Entrada publica.' },
          { id: 'ai_parse', label: 'IA desmenuza', description: 'OCR y clasificacion.' },
          { id: 'crm_handoff', label: 'CRM responde', description: 'Operador responde.' },
          { id: 'public_follow_up', label: 'Seguimiento publico', description: 'Link seguro.' },
        ],
        crm_receives: ['Archivo o texto original', 'Link publico de seguimiento'],
        empty_state: {
          title: 'Catalogo sin productos visibles, solicitud asistida activa',
          description: 'Aunque todavia no haya productos publicados, el vecino puede subir documentos.',
          primary_cta: 'Subir pedido o documento',
        },
      },
      frontend_contract: {
        show_assisted_intake: true,
      },
      publicCartUrl: 'https://chatboc.ar/t/junin/cart',
      whatsappShareUrl: 'https://wa.me/?text=Catalogo',
    });
    Element.prototype.scrollIntoView = vi.fn();
    window.scrollTo = vi.fn();
  });

  it('keeps assisted order upload visible and reachable when the public catalog has no products', async () => {
    render(
      <MemoryRouter initialEntries={['/t/junin/market']}>
        <Routes>
          <Route path="/t/:tenant/market" element={<MarketCatalogPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Pedido asistido por IA')).toBeInTheDocument();
    });

    expect(screen.getByTestId('assisted-first-banner')).toBeInTheDocument();
    expect(screen.getByText('Marketplace asistido activo')).toBeInTheDocument();
    expect(screen.getByText(/Subi el pedido como viene/i)).toBeInTheDocument();
    expect(screen.getByText('Foto de papel o manuscrito')).toBeInTheDocument();
    expect(screen.getByText('Pedido pegado desde WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Boleta, certificado o reclamo')).toBeInTheDocument();
    expect(screen.getByText('Salida operativa')).toBeInTheDocument();
    expect(screen.getByText(/Subi boletas, certificados, pedidos o notas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Boleta municipal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir foto o papel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Escribir pedido/i })).toBeInTheDocument();
    expect(screen.getByText('Foto, PDF o texto')).toBeInTheDocument();
    expect(screen.getByText('IA desmenuza')).toBeInTheDocument();
    expect(screen.getAllByText('CRM responde').length).toBeGreaterThan(0);
    expect(screen.getByText('Seguimiento publico')).toBeInTheDocument();
    expect(screen.getByText('El CRM recibe')).toBeInTheDocument();
    expect(screen.getByText('Archivo o texto original')).toBeInTheDocument();
    expect(screen.getByText('Link publico de seguimiento')).toBeInTheDocument();
    expect(screen.getByText('Nota manuscrita')).toBeInTheDocument();
    expect(screen.getByText('Boleta / impuesto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir pedido\/foto\/texto/i })).toBeInTheDocument();
    expect(screen.getByTestId('market-empty-state')).toBeInTheDocument();
    expect(screen.getByText('Subir foto o manuscrito')).toBeInTheDocument();
    expect(screen.getByText('Escribir lista')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Continuar por WhatsApp/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/solicitud asistida activa/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Subir pedido o documento/i }).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: /Subir pedido\/foto\/texto/i }));

    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    await waitFor(() => {
      expect(screen.getByTestId('assisted-upload-dropzone')).toHaveFocus();
    });
    expect(fetchMarketCatalogMock).toHaveBeenCalledWith(
      'junin',
      expect.objectContaining({ sort: 'promo_first' }),
    );
  });

  it('hides assisted intake when the backend frontend contract disables it', async () => {
    fetchMarketCatalogMock.mockResolvedValueOnce({
      products: [],
      promotions: { items: [] },
      facets: { categories: [], promotion_count: 0 },
      sort_options: [],
      total: 0,
      total_unfiltered: 0,
      assisted_intake: {
        contract_version: 'marketplace.assisted_intake_entry.v1',
        title: 'Carga asistida no visible',
      },
      frontend_contract: {
        show_assisted_intake: false,
      },
    });

    render(
      <MemoryRouter initialEntries={['/t/junin/market']}>
        <Routes>
          <Route path="/t/:tenant/market" element={<MarketCatalogPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchMarketCatalogMock).toHaveBeenCalled();
    });

    expect(screen.queryByText('Pedido asistido por IA')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assisted-first-banner')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir pedido\/foto\/texto/i })).toBeDisabled();
  });

  it('keeps a local assisted intake fallback when the catalog contract omits it', async () => {
    fetchMarketCatalogMock.mockResolvedValueOnce({
      products: [],
      promotions: { items: [] },
      facets: { categories: [], promotion_count: 0 },
      sort_options: [],
      total: 0,
      total_unfiltered: 0,
      frontend_contract: {
        show_assisted_intake: true,
      },
      publicCartUrl: 'https://chatboc.ar/t/junin/cart',
      whatsappShareUrl: null,
    });

    render(
      <MemoryRouter initialEntries={['/t/junin/market']}>
        <Routes>
          <Route path="/t/:tenant/market" element={<MarketCatalogPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('assisted-first-banner')).toBeInTheDocument();
    });

    expect(screen.getByText('Pedido asistido por IA')).toBeInTheDocument();
    expect(screen.getByText(/Funciona aunque el catalogo este vacio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ferreteria/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reclamo$/i })).toBeInTheDocument();
    expect(screen.getByText('Subida publica')).toBeInTheDocument();
    expect(screen.getByText('CRM operativo')).toBeInTheDocument();
    expect(screen.getByText('Link publico de seguimiento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir pedido\/foto\/texto/i })).toBeEnabled();
  });

  it('explains filtered empty results without hiding assisted intake', async () => {
    const filteredEmptyResponse = {
      products: [],
      promotions: { items: [] },
      facets: { categories: [], promotion_count: 0 },
      sort_options: [],
      total: 0,
      total_unfiltered: 3,
      frontend_contract: {
        show_assisted_intake: true,
      },
      publicCartUrl: 'https://chatboc.ar/t/junin/cart',
      whatsappShareUrl: 'https://wa.me/?text=Catalogo',
    };
    fetchMarketCatalogMock
      .mockResolvedValueOnce(filteredEmptyResponse)
      .mockResolvedValueOnce(filteredEmptyResponse);

    render(
      <MemoryRouter initialEntries={['/t/junin/market']}>
        <Routes>
          <Route path="/t/:tenant/market" element={<MarketCatalogPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('market-empty-state')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Buscar producto/i), {
      target: { value: 'no existe' },
    });

    await waitFor(() => {
      expect(fetchMarketCatalogMock).toHaveBeenCalledWith(
        'junin',
        expect.objectContaining({ q: 'no existe' }),
      );
    });

    expect(screen.getByText(/No hay productos para esos filtros/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Limpiar filtros/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir pedido\/foto\/texto/i })).toBeEnabled();
  });
});
