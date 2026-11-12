import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TenantTicketFormPage, { createClaimIdempotencyKey } from './TenantTicketFormPage';
import type { TenantClaimIntakeReceipt } from '@/types/tenant';

const mocks = vi.hoisted(() => ({
  submitTenantTicket: vi.fn(),
  toast: vi.fn(),
  writeText: vi.fn(),
  contextOverride: null as {
    tenant: { slug: string; nombre: string } | null;
    currentSlug: string | null;
    isLoadingTenant: boolean;
    tenantError: string | null;
  } | null,
}));

// The shared setup mocks navigation and params. These transitions use the router.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

vi.mock('@/api/tenant', () => ({
  submitTenantTicket: (...args: unknown[]) => mocks.submitTenantTicket(...args),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => {
    const { tenant } = useParams();
    if (mocks.contextOverride) return mocks.contextOverride;
    return {
      tenant: { slug: tenant, nombre: `Espacio ${tenant}` },
      currentSlug: tenant,
      isLoadingTenant: false,
      tenantError: null,
    };
  },
}));

vi.mock('@/components/tenant/TenantShell', () => ({
  TenantShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: (...args: unknown[]) => mocks.toast(...args),
}));

const receipt: TenantClaimIntakeReceipt = {
  contract_version: 'claims.intake_receipt.v1',
  ok: true,
  persisted: true,
  deduplicated: false,
  request_id: 'req-claim-1',
  claim: {
    id: 123,
    code: 'T-123',
    status: 'nuevo',
    category: 'Alumbrado',
    created_at: '2026-07-28T15:30:00Z',
  },
  access: {
    mode: 'code_pin',
    pin: '804231',
  },
  tracking: {
    path: '/tracking/claim/T-123#pin=804231',
    experience_endpoint: '/api/public/tracking/experience?kind=claim&code=T-123',
    credential_transport: 'x-tracking-pin-header',
    requires_pin: true,
  },
  actions: [
    {
      id: 'track_claim',
      label: 'Ver seguimiento',
      href: '/tracking/claim/T-123#pin=804231',
    },
  ],
};

const RouteControls = () => {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate('/t/junin/reclamos/nuevo')}>Ver espacio A</button>
      <button onClick={() => navigate('/t/otro-espacio/reclamos/nuevo')}>Ver espacio B</button>
    </>
  );
};

const page = () => (
    <MemoryRouter
      initialEntries={['/t/junin/reclamos/nuevo']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/t/:tenant/reclamos/nuevo" element={<><RouteControls /><TenantTicketFormPage /></>} />
      </Routes>
    </MemoryRouter>
);

const renderPage = () => render(page());

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

const navigateTo = (space: 'A' | 'B') =>
  fireEvent.click(screen.getByRole('button', { name: `Ver espacio ${space}` }));

const fillClaim = (description = 'Hay una luminaria apagada frente a la plaza') => {
  fireEvent.change(screen.getByLabelText('Tema o categoría (opcional)'), {
    target: { value: 'Alumbrado' },
  });
  fireEvent.change(screen.getByLabelText('Descripción'), {
    target: { value: description },
  });
};

describe('TenantTicketFormPage claim receipt', () => {
  beforeEach(() => {
    mocks.submitTenantTicket.mockReset();
    mocks.toast.mockReset();
    mocks.writeText.mockReset();
    mocks.contextOverride = null;
    mocks.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mocks.writeText },
    });
  });

  it('renders the confirmed receipt and keeps the PIN out of query strings', async () => {
    mocks.submitTenantTicket.mockResolvedValueOnce(receipt);
    renderPage();
    fillClaim();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));

    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();
    expect(screen.getByTestId('claim-code')).toHaveTextContent('T-123');
    expect(screen.getByTestId('claim-pin')).toHaveTextContent('••••••');
    expect(screen.queryByText('804231')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar PIN' }));
    expect(screen.getByTestId('claim-pin')).toHaveTextContent('804231');

    const trackingLink = screen.getByRole('link', { name: /ver seguimiento/i });
    expect(trackingLink).toHaveAttribute('href', '/tracking/claim/T-123#pin=804231');
    expect(trackingLink.getAttribute('href')).not.toContain('?pin=');
    expect(trackingLink).toHaveAttribute('referrerpolicy', 'no-referrer');

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código y PIN' }));
    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith('Código: T-123\nPIN: 804231');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear otro reclamo' }));
    expect(screen.queryByTestId('claim-intake-receipt')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Descripción')).toHaveValue('');
  });

  it('reuses the idempotency key when the same payload is retried after an invalid ack', async () => {
    mocks.submitTenantTicket
      .mockRejectedValueOnce(new Error('El servidor no confirmó un comprobante válido.'))
      .mockResolvedValueOnce(receipt);
    renderPage();
    fillClaim();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    await waitFor(() => expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Descripción')).toHaveValue(
      'Hay una luminaria apagada frente a la plaza',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();

    const firstKey = mocks.submitTenantTicket.mock.calls[0][2];
    const retryKey = mocks.submitTenantTicket.mock.calls[1][2];
    expect(firstKey).toMatch(/^claim-intake-/);
    expect(retryKey).toBe(firstKey);
  });

  it('rotates the idempotency key when the payload changes after a failed attempt', async () => {
    mocks.submitTenantTicket
      .mockRejectedValueOnce(new Error('network_error'))
      .mockResolvedValueOnce(receipt);
    renderPage();
    fillClaim('Primer detalle del reclamo');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    await waitFor(() => expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: 'Detalle corregido del reclamo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();

    expect(mocks.submitTenantTicket.mock.calls[1][2]).not.toBe(
      mocks.submitTenantTicket.mock.calls[0][2],
    );
  });

  it('fails closed when the browser has no cryptographically secure random source', () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(() => createClaimIdempotencyKey()).toThrow('criptografía segura');
    } finally {
      if (cryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
      }
    }
  });

  it('keeps all draft fields in their organization through A to B to A, without sending on navigation', () => {
    renderPage();
    fillClaim('Borrador del espacio A');
    fireEvent.change(screen.getByLabelText('Latitud (opcional)'), { target: { value: '-34.5' } });
    fireEvent.change(screen.getByLabelText('Longitud (opcional)'), { target: { value: '-58.5' } });

    navigateTo('B');
    expect(screen.getByLabelText('Tema o categoría (opcional)')).toHaveValue('');
    expect(screen.getByLabelText('Descripción')).toHaveValue('');
    expect(screen.getByLabelText('Latitud (opcional)')).toHaveValue(null);
    expect(screen.getByLabelText('Longitud (opcional)')).toHaveValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(mocks.submitTenantTicket).not.toHaveBeenCalled();
    fillClaim('Borrador del espacio B');

    navigateTo('A');
    expect(screen.getByLabelText('Descripción')).toHaveValue('Borrador del espacio A');
    expect(screen.getByLabelText('Tema o categoría (opcional)')).toHaveValue('Alumbrado');
    expect(screen.getByLabelText('Latitud (opcional)')).toHaveValue(-34.5);
    expect(screen.getByLabelText('Longitud (opcional)')).toHaveValue(-58.5);
    navigateTo('B');
    expect(screen.getByLabelText('Descripción')).toHaveValue('Borrador del espacio B');
    expect(mocks.submitTenantTicket).not.toHaveBeenCalled();
  });

  it.each(['B', 'A'] as const)('ignores a retired A rejection while %s is visible, including ABA', async (visibleSpace) => {
    const pending = deferred<TenantClaimIntakeReceipt>();
    mocks.submitTenantTicket.mockReturnValueOnce(pending.promise);
    renderPage();
    fillClaim('Envío del espacio A');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    navigateTo('B');
    if (visibleSpace === 'A') navigateTo('A');

    await act(async () => { pending.reject(new Error('Error demorado de A')); });
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Enviar reclamo' })).toBeEnabled();
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Descripción')).toHaveValue(visibleSpace === 'A' ? 'Envío del espacio A' : '');
  });

  it('ignores a retired A receipt after ABA and recovers it only on an explicit same-key retry', async () => {
    const pending = deferred<TenantClaimIntakeReceipt>();
    mocks.submitTenantTicket.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ ...receipt, deduplicated: true });
    renderPage();
    fillClaim('Envío incierto del espacio A');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    const firstKey = mocks.submitTenantTicket.mock.calls[0][2];
    const firstOptions = mocks.submitTenantTicket.mock.calls[0][3];
    expect(firstOptions.signal.aborted).toBe(false);
    expect(firstOptions.isCurrent()).toBe(true);
    navigateTo('B');
    navigateTo('A');
    expect(firstOptions.signal.aborted).toBe(true);
    expect(firstOptions.isCurrent()).toBe(false);

    await act(async () => { pending.resolve(receipt); });
    expect(screen.queryByTestId('claim-intake-receipt')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Descripción')).toHaveValue('Envío incierto del espacio A');
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(2);
    expect(mocks.submitTenantTicket.mock.calls[1].slice(0, 3)).toEqual(['junin', mocks.submitTenantTicket.mock.calls[0][1], firstKey]);
    expect(mocks.submitTenantTicket.mock.calls[1][3].signal).not.toBe(firstOptions.signal);
  });

  it.each(['B', 'A'] as const)('does not let an old A completion unlock a newer %s submission', async (activeSpace) => {
    const oldRequest = deferred<TenantClaimIntakeReceipt>();
    const currentRequest = deferred<TenantClaimIntakeReceipt>();
    mocks.submitTenantTicket.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(currentRequest.promise);
    renderPage();
    fillClaim('Primer envío A');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    const retiredOptions = mocks.submitTenantTicket.mock.calls[0][3];
    navigateTo('B');
    if (activeSpace === 'A') navigateTo('A');
    fillClaim(`Nuevo envío ${activeSpace}`);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(2);
    expect(mocks.submitTenantTicket.mock.calls[1][0]).toBe(activeSpace === 'A' ? 'junin' : 'otro-espacio');
    const currentOptions = mocks.submitTenantTicket.mock.calls[1][3];
    expect(retiredOptions.signal.aborted).toBe(true);
    expect(retiredOptions.isCurrent()).toBe(false);
    expect(currentOptions.signal.aborted).toBe(false);
    expect(currentOptions.isCurrent()).toBe(true);

    await act(async () => { oldRequest.resolve(receipt); });
    expect(screen.queryByTestId('claim-intake-receipt')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar reclamo' })).toBeDisabled();
    expect(currentOptions.isCurrent()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(2);

    await act(async () => { currentRequest.resolve(receipt); });
    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();
  });

  it('does not publish failure feedback after the form unmounts', async () => {
    const pending = deferred<TenantClaimIntakeReceipt>();
    mocks.submitTenantTicket.mockReturnValueOnce(pending.promise);
    const view = renderPage();
    fillClaim();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    const options = mocks.submitTenantTicket.mock.calls[0][3];
    view.unmount();
    expect(options.signal.aborted).toBe(true);
    expect(options.isCurrent()).toBe(false);

    await act(async () => { pending.reject(new Error('Error después del desmontaje')); });
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(1);
  });

  it('clears only the visible organization and keeps a failed attempt scoped across navigation', async () => {
    mocks.submitTenantTicket.mockRejectedValueOnce(new Error('No se confirmó el envío')).mockResolvedValueOnce(receipt);
    renderPage();
    fillClaim('Borrador A que debemos conservar');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'No se confirmó el envío' })));
    const firstKey = mocks.submitTenantTicket.mock.calls[0][2];
    expect(screen.getByLabelText('Descripción')).toHaveValue('Borrador A que debemos conservar');

    navigateTo('B');
    fillClaim('Borrador B');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByLabelText('Descripción')).toHaveValue('');
    navigateTo('A');
    expect(screen.getByLabelText('Descripción')).toHaveValue('Borrador A que debemos conservar');
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();
    expect(mocks.submitTenantTicket.mock.calls[1][2]).toBe(firstKey);
  });

  it('uses the route organization immediately and waits for its context to finish loading', () => {
    mocks.contextOverride = {
      tenant: { slug: 'junin', nombre: 'Espacio junin' },
      currentSlug: 'junin', isLoadingTenant: false, tenantError: null,
    };
    const view = renderPage();
    fillClaim('Borrador A antes de navegar');
    navigateTo('B');
    fireEvent.submit(screen.getByLabelText('Descripción').closest('form')!);
    expect(mocks.submitTenantTicket).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Descripción')).toHaveValue('');
    expect(screen.queryByText(/El equipo de Espacio junin recibirá/)).not.toBeInTheDocument();
    fillClaim('Borrador propio de B');
    expect(screen.getByRole('button', { name: 'Enviar reclamo' })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText('Descripción').closest('form')!);
    expect(mocks.submitTenantTicket).not.toHaveBeenCalled();

    mocks.contextOverride = { ...mocks.contextOverride, currentSlug: 'otro-espacio', isLoadingTenant: true };
    view.rerender(page());
    expect(screen.getByLabelText('Descripción')).toHaveValue('Borrador propio de B');
    fireEvent.submit(screen.getByLabelText('Descripción').closest('form')!);
    expect(mocks.submitTenantTicket).not.toHaveBeenCalled();

    mocks.contextOverride = { tenant: { slug: 'otro-espacio', nombre: 'Espacio otro-espacio' }, currentSlug: 'otro-espacio', isLoadingTenant: false, tenantError: null };
    view.rerender(page());
    expect(screen.getByRole('button', { name: 'Enviar reclamo' })).toBeEnabled();
    expect(screen.getByLabelText('Descripción')).toHaveValue('Borrador propio de B');
    expect(mocks.submitTenantTicket).not.toHaveBeenCalled();
  });

  it.each([
    { isLoadingTenant: true, tenantError: null },
    { isLoadingTenant: false, tenantError: 'No se confirmó el perfil' },
  ])('retires an in-flight receipt when its same-route context becomes unavailable: %j', async (unavailable) => {
    const pending = deferred<TenantClaimIntakeReceipt>();
    mocks.submitTenantTicket.mockReturnValueOnce(pending.promise);
    const view = renderPage();
    fillClaim('Borrador A');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    mocks.contextOverride = { tenant: { slug: 'junin', nombre: 'Espacio junin' }, currentSlug: 'junin', ...unavailable };
    view.rerender(page());
    mocks.contextOverride = null;
    view.rerender(page());
    await act(async () => { pending.resolve(receipt); });
    expect(screen.queryByTestId('claim-intake-receipt')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Descripción')).toHaveValue('Borrador A');
    expect(screen.getByRole('button', { name: 'Enviar reclamo' })).toBeEnabled();
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(1);
  });

  it('cannot submit a retained A description with the B organization on a preserved route instance', () => {
    mocks.submitTenantTicket.mockReturnValueOnce(deferred<TenantClaimIntakeReceipt>().promise);
    renderPage();
    fillClaim('Descripción que pertenece solamente a A');
    navigateTo('B');
    fireEvent.submit(screen.getByLabelText('Descripción').closest('form')!);
    expect(mocks.submitTenantTicket).not.toHaveBeenCalled();
  });

  it('keeps confirmed receipts in their own organization and retires PIN visibility and late copy feedback', async () => {
    const clipboard = deferred<void>();
    mocks.writeText.mockReturnValueOnce(clipboard.promise);
    mocks.submitTenantTicket.mockResolvedValueOnce(receipt).mockResolvedValueOnce({
      ...receipt,
      request_id: 'req-claim-B',
      claim: { ...receipt.claim, code: 'T-B' },
      access: { ...receipt.access, pin: '123456' },
    });
    renderPage();
    fillClaim('Reclamo A');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(await screen.findByTestId('claim-code')).toHaveTextContent('T-123');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar PIN' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar código y PIN' }));

    navigateTo('B');
    fillClaim('Reclamo B');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(await screen.findByTestId('claim-code')).toHaveTextContent('T-B');
    expect(screen.getByTestId('claim-pin')).toHaveTextContent('••••••');
    await act(async () => { clipboard.resolve(); });
    expect(screen.queryByText('Código y PIN copiados.')).not.toBeInTheDocument();

    navigateTo('A');
    expect(screen.getByTestId('claim-code')).toHaveTextContent('T-123');
    expect(screen.getByTestId('claim-pin')).toHaveTextContent('••••••');
    expect(screen.queryByText('Código y PIN copiados.')).not.toBeInTheDocument();
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(2);
  });

  it('requires a selection on a legacy route without a tenant param or currentSlug, despite a default profile', () => {
    mocks.contextOverride = {
      tenant: { slug: 'default', nombre: 'Chatboc' },
      currentSlug: null,
      isLoadingTenant: false,
      tenantError: null,
    };
    render(
      <MemoryRouter initialEntries={['/portal/reclamos/nuevo']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/portal/reclamos/nuevo" element={<TenantTicketFormPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Seleccioná un espacio' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Descripción')).not.toBeInTheDocument();
    expect(mocks.submitTenantTicket).not.toHaveBeenCalled();
  });

  it('preserves edits made while a claim is in flight when returning from its receipt', async () => {
    const pending = deferred<TenantClaimIntakeReceipt>();
    mocks.submitTenantTicket.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(receipt);
    renderPage();
    fillClaim('Descripción enviada originalmente');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    const sentKey = mocks.submitTenantTicket.mock.calls[0][2];
    expect(screen.getByLabelText('Descripción')).toBeEnabled();
    fillClaim('Nuevo borrador escrito durante el envío');
    fireEvent.change(screen.getByLabelText('Tema o categoría (opcional)'), { target: { value: 'Obras' } });
    fireEvent.change(screen.getByLabelText('Latitud (opcional)'), { target: { value: '-34.1' } });
    fireEvent.change(screen.getByLabelText('Longitud (opcional)'), { target: { value: '-58.1' } });
    expect(mocks.submitTenantTicket.mock.calls[0][1].descripcion).toBe('Descripción enviada originalmente');

    await act(async () => { pending.resolve(receipt); });
    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear otro reclamo' }));
    expect(screen.getByLabelText('Descripción')).toHaveValue('Nuevo borrador escrito durante el envío');
    expect(screen.getByLabelText('Tema o categoría (opcional)')).toHaveValue('Obras');
    expect(screen.getByLabelText('Latitud (opcional)')).toHaveValue(-34.1);
    expect(screen.getByLabelText('Longitud (opcional)')).toHaveValue(-58.1);
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();
    expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(2);
    expect(mocks.submitTenantTicket.mock.calls[1][1]).toEqual({ categoria: 'Obras', descripcion: 'Nuevo borrador escrito durante el envío', lat: -34.1, lng: -58.1 });
    expect(mocks.submitTenantTicket.mock.calls[1][2]).not.toBe(sentKey);
    fireEvent.click(screen.getByRole('button', { name: 'Crear otro reclamo' }));
    expect(screen.getByLabelText('Descripción')).toHaveValue('');
  });
});
