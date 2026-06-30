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
      expect(screen.getByText('Carga asistida')).toBeInTheDocument();
    });

    expect(screen.getByText('Sin registro')).toBeInTheDocument();
    expect(screen.getByTestId('market-assisted-command')).toBeInTheDocument();
    expect(screen.getByText(/Subi una foto, lista o documento/i)).toBeInTheDocument();
    expect(screen.getByText(/Subi una foto, lista, boleta o reclamo/i)).toBeInTheDocument();
    expect(screen.getByText(/Sirve para notas manuscritas/i)).toBeInTheDocument();
    expect(screen.getByTestId('market-assisted-public-promise')).toBeInTheDocument();
    expect(screen.getByText('Foto o manuscrito')).toBeInTheDocument();
    expect(screen.getByText('Texto de WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Documento o reclamo')).toBeInTheDocument();
    expect(screen.getByText('Seguimiento seguro')).toBeInTheDocument();
    expect(screen.queryByTestId('assisted-first-banner')).not.toBeInTheDocument();
    expect(screen.getByText(/Subi boletas, certificados, pedidos o notas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Boleta municipal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir foto o papel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Escribir pedido/i })).toBeInTheDocument();
    expect(screen.getByText('Foto, PDF o texto')).toBeInTheDocument();
    expect(screen.getByText('Datos ordenados')).toBeInTheDocument();
    expect(screen.getAllByText('Equipo responde').length).toBeGreaterThan(0);
    expect(screen.getByText('Seguimiento publico')).toBeInTheDocument();
    expect(screen.getByText('El equipo recibe')).toBeInTheDocument();
    expect(screen.getByText('Archivo o texto original')).toBeInTheDocument();
    expect(screen.getByText('Link publico de seguimiento')).toBeInTheDocument();
    expect(screen.getByText('Nota manuscrita')).toBeInTheDocument();
    expect(screen.getByText('Boleta / impuesto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir foto o archivo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Escribir lista/i })).toBeInTheDocument();
    expect(screen.queryByTestId('market-empty-state')).not.toBeInTheDocument();
    expect(screen.getAllByText('Escribir lista').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Continuar por WhatsApp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir foto o archivo/i })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bCRM\b|Intake IA|OCR \+ IA|\bIA\b desmenuza|lectura IA/i);

    fireEvent.click(screen.getByRole('button', { name: /Subir foto o archivo/i }));

    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    await waitFor(() => {
      expect(screen.getByTestId('assisted-upload-dropzone')).toHaveFocus();
    });
    expect(fetchMarketCatalogMock).toHaveBeenCalledWith(
      'junin',
      expect.objectContaining({ sort: 'promo_first' }),
    );
  });

  it('keeps assisted intake visible for an empty catalog even when the backend contract disables it', async () => {
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

    expect(screen.getByText('Carga asistida')).toBeInTheDocument();
    expect(screen.getByText('Sin registro')).toBeInTheDocument();
    expect(screen.getByTestId('market-assisted-command')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir foto o archivo/i })).toBeEnabled();
  });

  it('hides assisted intake when the catalog has products and the backend contract disables it', async () => {
    fetchMarketCatalogMock.mockResolvedValueOnce({
      products: [
        {
          id: 'prod-1',
          name: 'Bolsa de cemento',
          description: 'Cemento x 50kg',
          descriptionShort: null,
          price: 12000,
          priceText: null,
          currency: 'ARS',
          modality: 'venta',
          points: null,
          imageUrl: null,
          category: 'Materiales',
          unit: 'unidad',
          quantity: 8,
          sku: 'CEM-50',
          brand: null,
          promoInfo: null,
          publicUrl: '/t/junin/market/prod-1',
          whatsappShareUrl: null,
          disponible: true,
          checkout_type: 'chatboc',
        },
      ],
      promotions: { items: [] },
      facets: { categories: [{ value: 'Materiales', label: 'Materiales', count: 1 }], promotion_count: 0 },
      sort_options: [],
      total: 1,
      total_unfiltered: 1,
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
      expect(screen.getByText('Bolsa de cemento')).toBeInTheDocument();
    });

    expect(screen.queryByText('Carga asistida')).not.toBeInTheDocument();
    expect(screen.queryByText('Intake IA sin registro')).not.toBeInTheDocument();
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
      expect(screen.getByTestId('market-assisted-command')).toBeInTheDocument();
    });

    expect(screen.getByText('Carga asistida')).toBeInTheDocument();
    expect(screen.getByText('Sin registro')).toBeInTheDocument();
    expect(screen.getByText(/Funciona aunque el catalogo este vacio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ferreteria/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reclamo$/i })).toBeInTheDocument();
    expect(screen.getByText('Carga publica')).toBeInTheDocument();
    expect(screen.getByText('Equipo responde')).toBeInTheDocument();
    expect(screen.getByText('Link publico de seguimiento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir foto o archivo/i })).toBeEnabled();
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
