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
    expect(screen.getByRole('button', { name: /Subir nota o manuscrito/i })).toBeInTheDocument();
    expect(screen.getByText(/solicitud asistida activa/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir pedido o documento/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Subir nota o manuscrito/i }));

    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    await waitFor(() => {
      expect(screen.getByTestId('assisted-upload-dropzone')).toHaveFocus();
    });
    expect(fetchMarketCatalogMock).toHaveBeenCalledWith(
      'junin',
      expect.objectContaining({ sort: 'promo_first' }),
    );
  });
});
