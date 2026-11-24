import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getBrandIdentityAdmin: vi.fn(), putBrandIdentityAdmin: vi.fn() }));
vi.mock('@/api/brandIdentityAdmin', async (original) => ({ ...await original<typeof import('@/api/brandIdentityAdmin')>(), ...api }));

import { BrandIdentityAdminError } from '@/api/brandIdentityAdmin';
import BrandIdentityPanel from './BrandIdentityPanel';

// Synthetic organization; values only exercise the contract.
const stored = {
  palette: ['#112233', '#445566', '#778899'],
  gradient_stops: [{ color: '#112233', x: 0.1, y: 0.1 }, { color: '#445566', x: 0.9, y: 0.9 }],
  typography: { family: 'Synthetic Sans' },
  logo: { mark: 'https://assets.example.test/mark.png', alt: 'Organización sintética' },
  bubble_style: 'globa' as const,
  avatar: { style: 'brand_bot' as const },
};
const state = (brandIdentity: unknown, published = true) => ({ tenant: { id: 7, slug: 'org-sintetica' }, brandIdentity, published });
const renderPanel = () => render(<BrandIdentityPanel slug="org-sintetica" organizationName="Organización sintética" />);

beforeEach(() => { api.getBrandIdentityAdmin.mockReset(); api.putBrandIdentityAdmin.mockReset(); });
afterEach(() => { cleanup(); document.head.querySelectorAll('link[data-chatboc-brand-font]').forEach((link) => link.remove()); });

describe('BrandIdentityPanel', () => {
  it('shows the published identity with its preview and portal link', async () => {
    api.getBrandIdentityAdmin.mockResolvedValue(state(stored));
    renderPanel();
    expect(await screen.findByTestId('brand-identity-status')).toHaveTextContent('Publicada');
    const preview = screen.getByTestId('brand-preview');
    expect(within(preview).getByText('#445566')).toBeInTheDocument();
    expect(within(preview).getByText(/Con la mascota de la organización · burbujas globa/)).toBeInTheDocument();
    expect(within(preview).getByRole('link', { name: /Ver el portal publicado/ })).toHaveAttribute('href', '/t/org-sintetica');
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled();
    expect(screen.getByTestId('brand-preview-header').style.background).toContain('linear-gradient');
  });

  it('publishes an edited palette as the whole canonical record', async () => {
    api.getBrandIdentityAdmin.mockResolvedValue(state(stored));
    const edited = { ...stored, palette: ['#ABCDEF', '#445566', '#778899'] };
    api.putBrandIdentityAdmin.mockResolvedValue(state(edited));
    renderPanel();
    fireEvent.change(await screen.findByLabelText('Color 1 de la paleta'), { target: { value: '#abcdef' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar cambios' }));
    await waitFor(() => expect(api.putBrandIdentityAdmin).toHaveBeenCalledWith('org-sintetica', edited));
    expect(await screen.findByRole('status')).toHaveTextContent('Identidad publicada.');
  });

  it('explains invalid fields and does not publish them', async () => {
    api.getBrandIdentityAdmin.mockResolvedValue(state(stored));
    renderPanel();
    fireEvent.change(await screen.findByLabelText('Hoja de Google Fonts'), { target: { value: 'https://evil.example/x.css' } });
    expect(screen.getByTestId('brand-preview-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar cambios' }));
    expect(await screen.findByText('Revisá los campos marcados antes de publicar.')).toBeInTheDocument();
    expect(screen.getByLabelText('Hoja de Google Fonts')).toHaveAttribute('aria-invalid', 'true');
    expect(api.putBrandIdentityAdmin).not.toHaveBeenCalled();
  });

  it('says when a stored identity is not visible and shows the backend reason on failure', async () => {
    api.getBrandIdentityAdmin.mockResolvedValue(state(stored, false));
    api.putBrandIdentityAdmin.mockRejectedValue(new BrandIdentityAdminError('brand_identity_writer_fenced', 503));
    renderPanel();
    expect(await screen.findByTestId('brand-identity-status')).toHaveTextContent('Guardada, no visible');
    expect(screen.getByText(/solo se publica para una organización activa con plan Full/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ver el portal publicado/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Familia'), { target: { value: 'Otra Sans' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Las escrituras están pausadas');
  });

  it('removes the identity only after confirmation', async () => {
    api.getBrandIdentityAdmin.mockResolvedValue(state(stored));
    api.putBrandIdentityAdmin.mockResolvedValue(state(null, false));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar identidad' }));
    expect(api.putBrandIdentityAdmin).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(api.putBrandIdentityAdmin).toHaveBeenCalledWith('org-sintetica', null));
    expect(await screen.findByTestId('brand-identity-status')).toHaveTextContent('Sin identidad');
    expect(screen.getByRole('button', { name: 'Publicar identidad' })).toBeEnabled();
  });

  it('offers a retry when the identity cannot be read', async () => {
    api.getBrandIdentityAdmin.mockRejectedValueOnce(new BrandIdentityAdminError('brand_identity_superadmin_required', 403))
      .mockResolvedValueOnce(state(null, false));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo un superadmin');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByTestId('brand-identity-status')).toHaveTextContent('Sin identidad');
  });
});
