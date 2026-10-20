import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import type { RestorePreview, RestoreReceipt } from '@/api/surveyEditorialRelocation';
import { syntheticArchiveList as list, syntheticRestorePreview as preview, syntheticRestoreReceipt as receipt, syntheticRestoreKey as key,
  syntheticRelocationSource as source, syntheticRelocationAction as action, syntheticArchive as archive } from '../../../tests/fixtures/survey-editorial-relocation.synthetic';
const mocks = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn(), status: vi.fn(), session: {
  user: { id: 'synthetic-superadmin', rol: 'superadmin' }, hasVerifiedSession: true, organizationProfileVerified: true,
} }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => mocks.session }));
vi.mock('@/api/surveyEditorialRelocation', async importOriginal => ({ ...await importOriginal<typeof import('@/api/surveyEditorialRelocation')>(),
  getRestorePreview: mocks.preview, applyRestore: mocks.apply, getRestoreStatus: mocks.status }));
import { SurveyRestorePanel } from './SurveyRestorePanel';
const props = () => ({ tenantSlug: source.slug, surveys: list(), listReady: true, onCompleted: vi.fn(), onPendingChange: vi.fn() });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => {
  sessionStorage.clear(); mocks.session = { user: { id: 'synthetic-superadmin', rol: 'superadmin' }, hasVerifiedSession: true, organizationProfileVerified: true };
  mocks.preview.mockReset().mockResolvedValue(preview()); mocks.apply.mockReset().mockResolvedValue(receipt()); mocks.status.mockReset().mockResolvedValue(receipt());
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(key);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const review = async () => { fireEvent.click(screen.getByRole('button', { name: /Restaurar originales · #701/ })); const dialog = await screen.findByRole('dialog'); await within(dialog).findByRole('region'); return dialog; };
const confirm = () => screen.getByRole('button', { name: action.ui.restore_confirm_label });
describe('verified history restoration', () => {
  it('previews the real archive batch and confirms preserved history without publication', async () => {
    const p = props(); render(<SurveyRestorePanel {...p} />); const dialog = await review();
    expect(mocks.preview).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: source.id, slug: source.slug }), archive, expect.any(Function));
    expect(within(dialog).getByText(/#701.*archivada → cerrada/)).toBeVisible(); expect(within(dialog).getByText(/#702.*archivada → borrador/)).toBeVisible();
    expect(mocks.apply).not.toHaveBeenCalled(); fireEvent.click(confirm()); await within(dialog).findByText(action.ui.restore_success_message);
    expect(mocks.apply).toHaveBeenCalledExactlyOnceWith(preview(), key, expect.any(Function)); expect(p.onCompleted).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: action.ui.cancel_label })); expect(p.onCompleted).toHaveBeenCalledOnce();
  });
  it.each(['ordinary role', 'session', 'profile', 'non-history list', 'foreign tenant', 'missing lineage', 'list refresh'] as const)('makes no requests for %s', kind => {
    const p = props();
    if (kind === 'ordinary role') mocks.session.user.rol = 'admin_municipio';
    if (kind === 'session') mocks.session.hasVerifiedSession = false;
    if (kind === 'profile') mocks.session.organizationProfileVerified = false;
    if (kind === 'non-history list') p.surveys.include_archived = false;
    if (kind === 'foreign tenant') p.tenantSlug = 'foreign-organization';
    if (kind === 'missing lineage') delete p.surveys.archived_editorial_relocations;
    if (kind === 'list refresh') p.listReady = false;
    const view = render(<SurveyRestorePanel {...p} />); expect(view.container).toBeEmptyDOMElement(); expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('keeps backend denial closed', async () => { mocks.preview.mockResolvedValueOnce({ ...preview(), can_apply: false }); render(<SurveyRestorePanel {...props()} />); await review(); expect(confirm()).toBeDisabled(); });
  it('sends once and refuses dismissal while pending', async () => {
    const pending = deferred<RestoreReceipt>(); mocks.apply.mockReturnValueOnce(pending.promise); render(<SurveyRestorePanel {...props()} />); const dialog = await review(), button = confirm();
    fireEvent.click(button); fireEvent.click(button); expect(mocks.apply).toHaveBeenCalledOnce(); fireEvent.keyDown(dialog, { key: 'Escape' }); expect(dialog).toBeVisible();
    expect(within(dialog).getByRole('button', { name: action.ui.cancel_label })).toBeDisabled(); await act(async () => pending.resolve(receipt()));
  });
  it('preserves uncertain intent across remount and resolves only through GET status', async () => {
    mocks.apply.mockRejectedValueOnce(new ApiError('gateway', 503)); const p = props(), view = render(<SurveyRestorePanel {...p} />); await review(); fireEvent.click(confirm());
    await screen.findByText(action.ui.uncertain_message); view.unmount(); render(<SurveyRestorePanel {...p} />);
    fireEvent.click(screen.getByRole('button', { name: action.ui.check_status_label }));
    expect(screen.queryByRole('button', { name: action.ui.restore_confirm_label })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: action.ui.check_status_label })); await screen.findByText(action.ui.restore_success_message);
    expect(mocks.status).toHaveBeenCalledExactlyOnceWith(preview(), key, expect.any(Function)); expect(mocks.apply).toHaveBeenCalledOnce(); expect(crypto.randomUUID).toHaveBeenCalledOnce();
  });
  it('does not authorize a new POST after a missing uncertain receipt', async () => {
    mocks.apply.mockRejectedValueOnce(new TypeError('network')); mocks.status.mockRejectedValueOnce(new ApiError('not found', 404)); render(<SurveyRestorePanel {...props()} />);
    await review(); fireEvent.click(confirm()); await screen.findByText(action.ui.uncertain_message); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: action.ui.check_status_label }));
    await waitFor(() => expect(mocks.status).toHaveBeenCalledOnce()); expect(screen.queryByRole('button', { name: action.ui.restore_confirm_label })).not.toBeInTheDocument(); expect(mocks.apply).toHaveBeenCalledOnce();
  });
  it('requires a fresh explicit preview after a known conflict', async () => {
    mocks.apply.mockRejectedValueOnce(new ApiError('changed count', 409)); render(<SurveyRestorePanel {...props()} />); await review(); fireEvent.click(confirm()); await screen.findByText(action.ui.conflict_message);
    expect(screen.queryByRole('button', { name: action.ui.restore_confirm_label })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: action.ui.preview_label })); await screen.findByRole('region'); expect(mocks.preview).toHaveBeenCalledTimes(2); expect(mocks.apply).toHaveBeenCalledOnce();
  });
  it('refuses a write when its recovery reference cannot be stored', async () => {
    render(<SurveyRestorePanel {...props()} />); await review(); vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('blocked'); });
    fireEvent.click(confirm()); await screen.findByText(/No pudimos conservar la referencia/); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it.each(['actor', 'tenant', 'role'] as const)('retires a late preview after changing %s', async kind => {
    const pending = deferred<RestorePreview>(); mocks.preview.mockReturnValueOnce(pending.promise); const p = props(), view = render(<SurveyRestorePanel {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /Restaurar originales · #701/ })); const current = mocks.preview.mock.calls[0][2] as () => boolean;
    if (kind === 'actor') mocks.session.user.id = 'replacement'; if (kind === 'role') mocks.session.user.rol = 'admin_municipio';
    view.rerender(<SurveyRestorePanel {...p} tenantSlug={kind === 'tenant' ? 'foreign' : p.tenantSlug} />); expect(current()).toBe(false);
    await act(async () => pending.resolve(preview())); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('retires a pending response on logout before rerender', async () => {
    const pending = deferred<RestoreReceipt>(); mocks.apply.mockReturnValueOnce(pending.promise); render(<SurveyRestorePanel {...props()} />); await review(); fireEvent.click(confirm());
    const current = mocks.apply.mock.calls[0][2] as () => boolean; advanceChatbocSessionRevision(); expect(current()).toBe(false);
    await act(async () => pending.resolve(receipt())); expect(screen.queryByText(action.ui.restore_success_message)).not.toBeInTheDocument();
  });
});
