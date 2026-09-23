import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminDashboard from '@/pages/admin/SuperAdminDashboard';

const mocks = vi.hoisted(() => ({ list: vi.fn(), inventory: vi.fn(), executive: vi.fn(), command: vi.fn(), crm: vi.fn(), profile: vi.fn(), purge: vi.fn(), listeners: new Map<string, () => void>() }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/hooks/useRequireRole', () => ({ default: vi.fn() }));
vi.mock('@/api/client', () => ({ apiClient: { superAdminListTenants: mocks.list, superAdminListWhatsappNumbers: mocks.inventory, superAdminPurgeTenant: mocks.purge } }));
vi.mock('@/api/v2/saas', () => ({ getSuperadminExecutiveSummaryV2: mocks.executive, getSuperadminCommandCenterV2: mocks.command }));
vi.mock('@/utils/api', () => ({ apiFetch: mocks.crm }));
vi.mock('@/services/enterpriseService', () => ({ enterpriseService: { getTenantProfile360: mocks.profile } }));
vi.mock('@/context/SocketContext', () => ({ useSocket: () => ({ isConnected: false, socket: { on: (event: string, callback: () => void) => mocks.listeners.set(event, callback), off: (event: string) => mocks.listeners.delete(event) } }) }));
vi.mock('@/components/admin/TenantModal', () => ({ TenantModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div role="dialog">Formulario de organización</div> : null }));
vi.mock('@/components/admin/WhatsappInventoryPanel', () => ({ WhatsappInventoryPanel: () => <div>Inventario existente</div> }));
vi.mock('@/components/admin/SuperadminLeadsPipeline', () => ({ default: () => <div>Pipeline existente</div> }));
vi.mock('@/components/admin/ProductionSmokeReport', () => ({ default: () => <div>Comprobaciones existentes</div> }));
vi.mock('recharts', () => ({ ResponsiveContainer: () => <div aria-hidden="true" />, PieChart: () => null, Pie: () => null, Cell: () => null, BarChart: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null }));

const tenants = [
  { id: 1, nombre: 'Municipio Río', slug: 'rio', tipo: 'municipio', plan: 'enterprise', is_active: true, status: 'active' },
  { id: 2, nombre: 'Colegio Norte', slug: 'norte', tipo: 'colegio', plan: 'standard', is_active: true, status: 'active' },
];
const locationProbe = () => { const location = useLocation(); return <output data-testid="location">{location.search}</output>; };
function mount(entry = '/superadmin') { const Probe = locationProbe; return render(<MemoryRouter initialEntries={[entry]}><SuperAdminDashboard /><Probe /></MemoryRouter>); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((res) => { resolve = res; }); return { promise, resolve }; }
beforeEach(() => {
  vi.clearAllMocks(); mocks.listeners.clear();
  mocks.list.mockResolvedValue({ tenants, total: 102 });
  mocks.inventory.mockResolvedValue({ numbers: [] });
  mocks.executive.mockResolvedValue({}); mocks.command.mockResolvedValue({});
  mocks.crm.mockResolvedValue({ items: [{ contact_id: '1', name: 'Contacto QA', summary: 'Consulta general. Entro por widget (web_widget): __INIT__', tenant: { nombre: 'Río', slug: 'rio' } }], summary: {} });
  mocks.profile.mockImplementation((slug: string) => Promise.resolve({ tenant: { slug, nombre: `Ficha ${slug}` }, meta: { last_updated_at: '2026-09-23T12:00:00Z' } }));
});

describe('SuperAdminDashboard workspace', () => {
  it('deep links sections, preserves existing work and opens creation without an automatic profile request', async () => {
    mount('/superadmin?section=organizations');
    expect(await screen.findByRole('button', { name: 'Municipio Río' })).toBeInTheDocument();
    expect(mocks.profile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'CRM' }));
    expect(await screen.findByText('Contacto QA')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('section=crm');
    expect(screen.getByText('Conversación iniciada; sin motivo registrado.')).toBeInTheDocument();
    expect(screen.queryByText('__INIT__')).not.toBeInTheDocument();
    expect(screen.getByText('Pipeline existente')).toBeInTheDocument();
    expect(screen.getByText(/Actualización en vivo desconectada/)).toBeInTheDocument();
    expect(mocks.crm).toHaveBeenCalledWith('/api/admin/crm/leads?limit=8', { omitTenant: true });
    fireEvent.click(screen.getByRole('link', { name: 'Canales' }));
    expect(screen.getByText('Inventario existente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva organización' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Formulario de organización');
  });
  it('does not invent zeros when platform services fail', async () => {
    mocks.list.mockRejectedValue(new Error('offline')); mocks.crm.mockRejectedValue(new Error('offline')); mocks.executive.mockRejectedValue(new Error('offline')); mocks.command.mockRejectedValue(new Error('offline'));
    mount();
    await waitFor(() => expect(screen.getAllByText('No disponible')).toHaveLength(4));
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getAllByText('Distribución no disponible.')).toHaveLength(2);
  });
  it('recovers unavailable overview services after an explicit refresh and prevents duplicate refreshes', async () => {
    mocks.list.mockRejectedValueOnce(new Error('503'));
    mocks.crm.mockRejectedValueOnce(new Error('503'));
    mocks.executive.mockRejectedValueOnce(new Error('503'));
    mocks.command.mockRejectedValueOnce(new Error('503'));
    mount();
    await waitFor(() => expect(screen.getAllByText('No disponible')).toHaveLength(4));
    const directory = deferred<any>();
    mocks.list.mockReturnValueOnce(directory.promise);
    mocks.executive.mockResolvedValueOnce({ contract_version: 'superadmin.executive_summary.v1', summary: { tenants: 2 }, tenant_health: { items: [
      { tenant: { slug: 'rio', nombre: 'Municipio Río' }, health: { score: 60 } },
    ] } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar resumen' }));
    expect(screen.getByRole('button', { name: 'Actualizar resumen' })).toBeDisabled();
    await act(async () => { directory.resolve({ tenants, total: 2 }); await directory.promise; });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar resumen' })).toBeEnabled());
    const metric = (label: string) => within(screen.getByText(label, { selector: '.platform-metric-label span' }).closest('article')!);
    expect(metric('Organizaciones').getByText('2')).toBeInTheDocument();
    expect(metric('Organizaciones activas').getByText('2')).toBeInTheDocument();
    expect(metric('Contactos CRM recientes').getByText('1')).toBeInTheDocument();
    expect(metric('Índice operativo').getByText('60')).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledTimes(2); expect(mocks.crm).toHaveBeenCalledTimes(2);
    expect(mocks.executive).toHaveBeenCalledTimes(2); expect(mocks.command).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Distribución no disponible.')).not.toBeInTheDocument();
  });
  it('appends another directory page and displays the actual loaded coverage', async () => {
    mocks.list.mockResolvedValueOnce({ tenants: [tenants[0]], total: 2 }).mockResolvedValueOnce({ tenants: [tenants[1]], total: 2 });
    mount('/superadmin?section=organizations');
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más organizaciones' }));
    await waitFor(() => expect(screen.getByText('2 resultados · 2 organizaciones cargadas de 2')).toBeInTheDocument());
    expect(mocks.list).toHaveBeenNthCalledWith(2, 2, 100);
    expect(screen.queryByRole('button', { name: 'Cargar más organizaciones' })).not.toBeInTheDocument();
  });
  it('discards a late profile after selecting a different organization', async () => {
    const first = deferred<any>(); mocks.profile.mockImplementation((slug: string) => slug === 'rio' ? first.promise : Promise.resolve({ tenant: { slug: 'norte', nombre: 'Ficha Norte' } }));
    mount('/superadmin?section=organizations');
    fireEvent.click(await screen.findByRole('button', { name: 'Municipio Río' }));
    await waitFor(() => expect(mocks.profile).toHaveBeenCalledWith('rio', { since_days: 30 }));
    fireEvent.click(screen.getByRole('button', { name: 'Colegio Norte' }));
    expect(await screen.findByRole('heading', { name: 'Ficha Norte' })).toBeInTheDocument();
    await act(async () => { first.resolve({ tenant: { slug: 'rio', nombre: 'Ficha anterior' } }); await first.promise; });
    expect(screen.queryByText('Ficha anterior')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('organization=norte');
  });
  it('keeps the newest CRM refresh when event responses arrive out of order', async () => {
    mount('/superadmin?section=crm');
    await screen.findByText('Contacto QA');
    const older = deferred<any>(); const newer = deferred<any>();
    mocks.crm.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    act(() => { mocks.listeners.get('crm.contact.updated')?.(); mocks.listeners.get('crm.contact.updated')?.(); });
    await act(async () => { newer.resolve({ items: [{ contact_id: 'b', name: 'Contacto actualizado' }] }); await newer.promise; });
    expect(await screen.findByText('Contacto actualizado')).toBeInTheDocument();
    await act(async () => { older.resolve({ items: [{ contact_id: 'a', name: 'Contacto anterior' }] }); await older.promise; });
    expect(screen.queryByText('Contacto anterior')).not.toBeInTheDocument();
    expect(screen.getByText('Contacto actualizado')).toBeInTheDocument();
  });
});
