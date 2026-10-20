import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantDomainSettings } from './TenantDomainSettings';
import { domainPayload, domainScope } from '@/test/fixtures/tenantDomain';
import { readTenantDomain, type TenantDomainDescriptor } from '@/api/tenantDomain';

const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/api/tenantDomain', async () => ({
  ...await vi.importActual<typeof import('@/api/tenantDomain')>('@/api/tenantDomain'),
  getTenantDomain: mocks.get, saveTenantDomain: mocks.save,
}));
const descriptor = (patch: Record<string, unknown> = {}) => readTenantDomain(domainPayload(patch), domainScope);
const unconfigured = () => descriptor({ status: 'unconfigured', host: null, dns_proof: null, can_revoke: false });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => { mocks.get.mockReset().mockResolvedValue(unconfigured()); mocks.save.mockReset(); });
function mount() { return render(<TenantDomainSettings tenant={domainScope} scopeKey="session-a" />); }

describe('truthful organization domain lifecycle', () => {
  it('keeps a request pending and exposes the real TXT without claiming publication', async () => {
    mocks.save.mockResolvedValue(descriptor()); mount();
    await screen.findByText('Sin dominio propio');
    fireEvent.change(screen.getByLabelText('Dominio completo'), { target: { value: 'atencion.example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar verificación' }));
    await screen.findByText('Pendiente de verificar DNS');
    expect(mocks.save).toHaveBeenCalledWith(domainScope, expect.objectContaining({ revision: 'a'.repeat(64) }), 'request', 'atencion.example.test', expect.any(Function));
    expect(screen.getByText('_chatboc-verify.atencion.example.test')).toBeInTheDocument();
    expect(screen.getByText('chatboc-domain-verification=' + 'b'.repeat(64))).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir sitio público' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activar|publicar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Este panel no realiza cambios en tu proveedor/)).toBeInTheDocument();
  });

  it('verifies only DNS and retains the pending HTTPS/publication state', async () => {
    mocks.get.mockResolvedValue(descriptor());
    mocks.save.mockResolvedValue(descriptor({ status: 'pending_platform', dns_proof: null })); mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Comprobar TXT' }));
    await screen.findByText('DNS confirmado · falta publicación y HTTPS');
    expect(mocks.save).toHaveBeenCalledWith(domainScope, expect.any(Object), 'verify_dns', undefined, expect.any(Function));
    expect(screen.queryByRole('link', { name: 'Abrir sitio público' })).not.toBeInTheDocument();
  });

  it('blocks duplicate submits while the request is pending', async () => {
    const pending = deferred<TenantDomainDescriptor>(); mocks.save.mockReturnValue(pending.promise); mount();
    await screen.findByText('Sin dominio propio');
    const input = screen.getByLabelText('Dominio completo');
    fireEvent.change(input, { target: { value: 'atencion.example.test' } });
    const button = screen.getByRole('button', { name: 'Solicitar verificación' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.save).toHaveBeenCalledTimes(1); expect(button).toBeDisabled();
    await act(async () => { pending.resolve(descriptor()); });
    expect(await screen.findByText('Pendiente de verificar DNS')).toBeInTheDocument();
  });

  it('keeps work on a failed request and provides one explicit refresh', async () => {
    mocks.save.mockRejectedValue(new Error('secret provider diagnostic')); mount();
    await screen.findByText('Sin dominio propio');
    fireEvent.change(screen.getByLabelText('Dominio completo'), { target: { value: 'atencion.example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar verificación' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Dominio completo')).toHaveValue('atencion.example.test');
    expect(screen.queryByText(/secret provider diagnostic/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recargar estado' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it('requires confirmation before revocation and never substitutes another operation', async () => {
    mocks.get.mockResolvedValue(descriptor({ status: 'active', active: true, dns_proof: null, valid_until: Math.floor(Date.now()/1000)+3600 }));
    mocks.save.mockResolvedValue(descriptor({ status: 'revoked', dns_proof: null, can_revoke: false })); mount();
    expect(await screen.findByRole('link', { name: 'Abrir sitio público' })).toHaveAttribute('href', 'https://atencion.example.test/');
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular dominio' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument(); expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular dominio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desvinculación' }));
    await screen.findByText('Dominio desvinculado');
    expect(mocks.save).toHaveBeenCalledWith(domainScope, expect.any(Object), 'revoke', undefined, expect.any(Function));
  });

  it('uses server permissions, including revocation after a plan downgrade', async () => {
    mocks.get.mockResolvedValue(descriptor({ can_edit: false, reason_code: 'pro_plan_required' })); mount();
    await screen.findByText('Pendiente de verificar DNS');
    expect(screen.queryByRole('button', { name: 'Comprobar TXT' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dominio completo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desvincular dominio' })).toBeInTheDocument();
  });

  it('withdraws old data and ignores a late result when the organization/session changes', async () => {
    const old = deferred<TenantDomainDescriptor>(); mocks.get.mockReturnValueOnce(old.promise).mockResolvedValueOnce(unconfigured());
    const view = mount();
    view.rerender(<TenantDomainSettings tenant={domainScope} scopeKey="session-b" />);
    await screen.findByText('Sin dominio propio');
    await act(async () => old.resolve(descriptor()));
    expect(screen.queryByText('Pendiente de verificar DNS')).not.toBeInTheDocument();
    expect(mocks.get.mock.calls[0][1]()).toBe(false);
    expect(mocks.get.mock.calls[1][1]()).toBe(true);
  });
  it('retires a pending save after a session change without claiming the old request succeeded', async () => {
    const pending = deferred<TenantDomainDescriptor>(); mocks.save.mockReturnValue(pending.promise);
    const view = mount(); await screen.findByText('Sin dominio propio');
    fireEvent.change(screen.getByLabelText('Dominio completo'), { target: { value: 'atencion.example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar verificación' }));
    view.rerender(<TenantDomainSettings tenant={domainScope} scopeKey="session-b" />);
    await screen.findByText('Sin dominio propio');
    await act(async () => { pending.resolve(descriptor()); });
    expect(screen.queryByText('Pendiente de verificar DNS')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Dominio completo')).toHaveValue('');
    expect(mocks.save.mock.calls[0][4]()).toBe(false);
  });
});

  it('retires an active observation at its deadline without inventing a revocation or retry', async () => {
    vi.useFakeTimers();
    try {
      const expiry = Math.floor(Date.now() / 1000) + 2;
      mocks.get.mockResolvedValueOnce(descriptor({ status: 'active', active: true, dns_proof: null, valid_until: expiry }));
      await act(async () => { mount(); });
      expect(screen.getByRole('link', { name: 'Abrir sitio público' })).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
      expect(screen.queryByText('Dominio verificado y activo')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Abrir sitio público' })).not.toBeInTheDocument();
      expect(screen.getByText(/Actualizá el estado para confirmar la vigencia del dominio/)).toBeInTheDocument();
      expect(screen.queryByText('Dominio desvinculado')).not.toBeInTheDocument();
      expect(mocks.get).toHaveBeenCalledTimes(1);
      expect(mocks.save).not.toHaveBeenCalled();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Recargar estado' })); });
      expect(mocks.get).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText('Dominio completo')).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

describe('domain expiry and accessible controls', () => {
  it('disables an expired DNS proof without copying, checking, or retrying it', async () => {
    vi.useFakeTimers();
    try {
      const pending = descriptor();
      pending.dns_proof!.expires_at = Math.floor(Date.now()/1000)+2;
      mocks.get.mockResolvedValue(pending);
      await act(async () => { mount(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
      expect(screen.getByText(/El plazo de este registro TXT venció/)).toBeInTheDocument();
      const copy = screen.getByRole('button', { name: 'Copiar valor TXT' });
      const verify = screen.getByRole('button', { name: 'Comprobar TXT' });
      expect(copy).toBeDisabled(); expect(verify).toBeDisabled();
      fireEvent.click(copy); fireEvent.click(verify);
      expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.get).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it('returns keyboard focus to refresh only when the focused public link expires', async () => {
    vi.useFakeTimers();
    try {
      mocks.get.mockResolvedValue(descriptor({ status:'active',active:true,dns_proof:null,valid_until:Math.floor(Date.now()/1000)+2 }));
      await act(async () => { mount(); });
      screen.getByRole('link', { name:'Abrir sitio público' }).focus();
      await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
      expect(screen.getByRole('button', { name:'Recargar estado' })).toHaveFocus();
    } finally { vi.useRealTimers(); }
  });

  it('keeps focus in another task when the public observation expires', async () => {
    vi.useFakeTimers();
    try {
      mocks.get.mockResolvedValue(descriptor({ status:'active',active:true,dns_proof:null,valid_until:Math.floor(Date.now()/1000)+2 }));
      await act(async () => { render(<><input aria-label="Otra consulta" /><TenantDomainSettings tenant={domainScope} scopeKey="session-a" /></>); });
      screen.getByRole('textbox', { name:'Otra consulta' }).focus();
      await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
      expect(screen.getByRole('textbox', { name:'Otra consulta' })).toHaveFocus();
    } finally { vi.useRealTimers(); }
  });

  it('checks expiry when returning to the page and cannot revive the same observation with a reversed clock', async () => {
    vi.useFakeTimers();
    try {
      const original = Date.now(), expiry = Math.floor(original/1000)+2;
      mocks.get.mockResolvedValue(descriptor({ status:'active',active:true,dns_proof:null,valid_until:expiry }));
      await act(async () => { mount(); });
      vi.setSystemTime((expiry+1)*1000);
      await act(async () => { fireEvent(document,new Event('visibilitychange')); });
      expect(screen.queryByRole('link', { name:'Abrir sitio público' })).not.toBeInTheDocument();
      vi.setSystemTime(original);
      await act(async () => { fireEvent(document,new Event('visibilitychange')); });
      expect(screen.queryByRole('link', { name:'Abrir sitio público' })).not.toBeInTheDocument();
      expect(mocks.get).toHaveBeenCalledTimes(1); expect(mocks.save).not.toHaveBeenCalled();
      mocks.get.mockResolvedValue(descriptor({ status:'active',active:true,dns_proof:null,valid_until:expiry+3600 }));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name:'Recargar estado' })); });
      expect(screen.getByRole('link', { name:'Abrir sitio público' })).toBeInTheDocument();
      expect(mocks.get).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  it('cannot submit a revocation confirmation based on an observation that expired while open', async () => {
    vi.useFakeTimers();
    try {
      mocks.get.mockResolvedValue(descriptor({ status:'active',active:true,dns_proof:null,valid_until:Math.floor(Date.now()/1000)+2 }));
      await act(async () => { mount(); });
      fireEvent.click(screen.getByRole('button', { name:'Desvincular dominio' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
      const action=screen.getByRole('button', { name:'Confirmar desvinculación' });
      expect(action).toBeDisabled(); fireEvent.click(action);
      expect(mocks.save).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name:'Cancelar' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('retires an old deadline when the session changes and preserves a new draft', async () => {
    vi.useFakeTimers();
    try {
      mocks.get.mockResolvedValueOnce(descriptor({ status:'active',active:true,dns_proof:null,valid_until:Math.floor(Date.now()/1000)+2 }));
      let view:ReturnType<typeof mount>;
      await act(async () => { view=mount(); });
      await act(async () => { view!.rerender(<TenantDomainSettings tenant={domainScope} scopeKey="session-b" />); });
      fireEvent.change(screen.getByLabelText('Dominio completo'),{target:{value:'nuevo.example.test'}});
      await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
      expect(screen.getByLabelText('Dominio completo')).toHaveValue('nuevo.example.test');
      expect(screen.queryByText('Estado pendiente de actualización')).not.toBeInTheDocument();
      expect(mocks.get).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  it('gives each domain input its own label and format instructions', async () => {
    render(<><TenantDomainSettings tenant={domainScope} scopeKey="session-a" /><TenantDomainSettings tenant={domainScope} scopeKey="session-b" /></>);
    const inputs=await screen.findAllByLabelText('Dominio completo');
    expect(inputs).toHaveLength(2); expect(inputs[0].id).not.toBe(inputs[1].id);
    for(const input of inputs)expect(input).toHaveAccessibleDescription('Sin https://, puerto ni ruta. La propiedad se comprueba con un registro TXT.');
  });

  it('does not transfer a retired link focus repair to another session observation', async () => {
    vi.useFakeTimers();
    try {
      const now = Date.now(), firstExpiry = Math.floor(now / 1000) + 2;
      mocks.get
        .mockResolvedValueOnce(descriptor({ status:'active',active:true,dns_proof:null,valid_until:firstExpiry }))
        .mockResolvedValueOnce(descriptor({ status:'active',active:true,dns_proof:null,valid_until:firstExpiry + 3 }));
      let view:ReturnType<typeof mount>;
      await act(async () => { view=mount(); });
      screen.getByRole('link', { name:'Abrir sitio público' }).focus();
      // Visibility and the session cutover can be batched before expiry renders.
      await act(async () => {
        vi.setSystemTime((firstExpiry + 1) * 1000);
        fireEvent(document,new Event('visibilitychange'));
        view!.rerender(<TenantDomainSettings tenant={domainScope} scopeKey="session-b" />);
      });
      expect(screen.getByRole('link', { name:'Abrir sitio público' })).toBeInTheDocument();
      expect(document.body).toHaveFocus();
      await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
      expect(screen.queryByRole('link', { name:'Abrir sitio público' })).not.toBeInTheDocument();
      expect(document.body).toHaveFocus();
      expect(screen.getByRole('button', { name:'Recargar estado' })).not.toHaveFocus();
      expect(mocks.get).toHaveBeenCalledTimes(2);expect(mocks.save).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});
