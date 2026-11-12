import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { syntheticRelocationAction as action, syntheticRelocationList as list, syntheticRelocationPreview as preview,
  syntheticRelocationReceipt as receipt, syntheticRelocationKey as key, syntheticRelocationSource as source,
  syntheticRelocationTarget as target } from '../../../tests/fixtures/survey-editorial-relocation.synthetic';
import type { RelocationPreview, RelocationReceipt } from '@/api/surveyEditorialRelocation';

const mocks = vi.hoisted(() => ({ directory: vi.fn(), preview: vi.fn(), apply: vi.fn(), status: vi.fn(), session: {
  user: { id: 'synthetic-superadmin', rol: 'superadmin' }, hasVerifiedSession: true, organizationProfileVerified: true,
} }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => mocks.session }));
vi.mock('@/api/surveyEditorialRelocation', async importOriginal => ({ ...await importOriginal<typeof import('@/api/surveyEditorialRelocation')>(),
  listRelocationTargets: mocks.directory, getRelocationPreview: mocks.preview, applyRelocation: mocks.apply, getRelocationStatus: mocks.status }));
import { SurveyRelocationPanel } from './SurveyRelocationPanel';
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const props = () => ({ tenantSlug: source.slug, surveys: list(), listReady: true, onCompleted: vi.fn(), onPendingChange: vi.fn() });
beforeEach(() => {
  sessionStorage.clear();
  mocks.session = { user: { id: 'synthetic-superadmin', rol: 'superadmin' }, hasVerifiedSession: true, organizationProfileVerified: true };
  mocks.directory.mockReset().mockResolvedValue({ items: [source, target], hasMore: false });
  mocks.preview.mockReset().mockResolvedValue(preview()); mocks.apply.mockReset().mockResolvedValue(receipt()); mocks.status.mockReset().mockResolvedValue(receipt());
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(key);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const openAndSelect = async () => {
  fireEvent.click(screen.getByRole('button', { name: action.label }));
  const dialog = await screen.findByRole('dialog', { name: action.label });
  await within(dialog).findByRole('option', { name: `${target.nombre} · ${target.slug}` });
  within(dialog).getAllByRole('checkbox').forEach(box => fireEvent.click(box));
  fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: target.id } });
  return dialog;
};
const reviewSelection = async () => {
  const dialog = await openAndSelect(); fireEvent.click(within(dialog).getByRole('button', { name: action.ui.preview_label }));
  await within(dialog).findByText(preview().ui.preservation_notice); return dialog;
};
const confirm = () => screen.getByRole('button', { name: preview().ui.confirm_label });

describe('verified SuperAdmin survey archive and draft recreation', () => {
  it('shows the five exact IDs and all-time history despite zero filtered list metrics, then confirms one scoped intent', async () => {
    const p = props(); render(<SurveyRelocationPanel {...p} />);
    expect(screen.getByRole('link', { name: action.ui.history_label })).toHaveAttribute('href', `/admin/encuestas?tenant_slug=${source.slug}&include_archived=true`);
    const dialog = await reviewSelection();
    expect(mocks.directory).toHaveBeenCalledExactlyOnceWith(1, expect.any(Function));
    expect(mocks.preview).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: source.id, slug: source.slug }), target, [701, 702, 703, 704, 705], expect.any(Function));
    const review = within(dialog).getByRole('region', { name: preview().ui.response_count_label });
    for (const item of preview().items) expect(within(review).getByText(`#${item.survey_id} · ${item.title} · ${item.state}`, { exact: false })).toBeVisible();
    expect(within(review).getByText(/Respuestas de todo el historial: 101/)).toBeVisible();
    expect(within(review).getByText(/Respuestas de todo el historial: 200/)).toBeVisible();
    expect(within(dialog).getByText(preview().ui.published_warning)).toBeVisible();
    expect(mocks.apply).not.toHaveBeenCalled(); fireEvent.click(confirm());
    await within(dialog).findByText(action.ui.success_message);
    expect(mocks.apply).toHaveBeenCalledExactlyOnceWith(preview(), key, expect.any(Function));
    expect(p.onCompleted).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('link', { name: action.ui.history_label })).toHaveAttribute('href', `/admin/encuestas?tenant_slug=${source.slug}&include_archived=true`);
    fireEvent.click(within(dialog).getByRole('button', { name: action.ui.cancel_label })); expect(p.onCompleted).toHaveBeenCalledOnce();
  });
  it.each(['unverified session', 'unverified profile', 'municipal administrator', 'missing backend action', 'foreign list tenant', 'list refresh'] as const)('makes no requests for %s', kind => {
    const p = props();
    if (kind === 'unverified session') mocks.session.hasVerifiedSession = false;
    if (kind === 'unverified profile') mocks.session.organizationProfileVerified = false;
    if (kind === 'municipal administrator') mocks.session.user.rol = 'admin_municipio';
    if (kind === 'missing backend action') delete p.surveys.editorial_relocation;
    if (kind === 'foreign list tenant') p.surveys.tenant = target;
    if (kind === 'list refresh') p.listReady = false;
    const view = render(<SurveyRelocationPanel {...p} />); expect(view.container).toBeEmptyDOMElement();
    expect(mocks.directory).not.toHaveBeenCalled(); expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('never enables confirmation when the backend preview denies application', async () => {
    mocks.preview.mockResolvedValueOnce({ ...preview(), can_apply: false }); render(<SurveyRelocationPanel {...props()} />); await reviewSelection();
    expect(confirm()).toBeDisabled(); fireEvent.click(confirm()); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('prevents duplicate clicks and refuses dismissal during the pending POST', async () => {
    const pending = deferred<RelocationReceipt>(); mocks.apply.mockReturnValueOnce(pending.promise);
    render(<SurveyRelocationPanel {...props()} />); const dialog = await reviewSelection(), button = confirm();
    fireEvent.click(button); fireEvent.click(button); expect(mocks.apply).toHaveBeenCalledOnce();
    expect(within(dialog).getByRole('button', { name: action.ui.cancel_label })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(dialog).toBeVisible();
    await act(async () => pending.resolve(receipt())); expect(within(dialog).getByRole('button', { name: action.ui.cancel_label })).toBeEnabled();
  });
  it.each(['gateway', 'network', 'invalid receipt'] as const)('retains one uncertain %s intent through closing and reopening, and only offers GET status', async kind => {
    mocks.apply.mockRejectedValueOnce(kind === 'network' ? new TypeError('Failed to fetch') : new ApiError(kind, kind === 'gateway' ? 503 : 502));
    render(<SurveyRelocationPanel {...props()} />); await reviewSelection(); fireEvent.click(confirm());
    await screen.findByText(action.ui.uncertain_message); expect(screen.queryByRole('button', { name: preview().ui.confirm_label })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: action.ui.cancel_label })); fireEvent.click(screen.getByRole('button', { name: action.label }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(mocks.preview).toHaveBeenCalledOnce(); expect(mocks.apply).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: action.ui.check_status_label })); await screen.findByText(action.ui.success_message);
    expect(mocks.status).toHaveBeenCalledExactlyOnceWith(preview(), key, expect.any(Function)); expect(mocks.apply).toHaveBeenCalledOnce();
  });
  it('does not treat status-not-found as authorization to create a new intent', async () => {
    mocks.apply.mockRejectedValueOnce(new ApiError('gateway', 503)); mocks.status.mockRejectedValueOnce(new ApiError('relocation_receipt_not_found', 404));
    render(<SurveyRelocationPanel {...props()} />); await reviewSelection(); fireEvent.click(confirm()); await screen.findByText(action.ui.uncertain_message);
    fireEvent.click(screen.getByRole('button', { name: action.ui.check_status_label })); await waitFor(() => expect(mocks.status).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: preview().ui.confirm_label })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: action.ui.preview_label })).not.toBeInTheDocument(); expect(mocks.apply).toHaveBeenCalledOnce();
  });
  it('recovers an unresolved intent after a route remount without generating another key or POST', async () => {
    mocks.apply.mockRejectedValueOnce(new ApiError('gateway', 503)); const p = props(), view = render(<SurveyRelocationPanel {...p} />);
    await reviewSelection(); fireEvent.click(confirm()); await screen.findByText(action.ui.uncertain_message); view.unmount();
    render(<SurveyRelocationPanel {...p} />); fireEvent.click(screen.getByRole('button', { name: action.label }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(mocks.directory).toHaveBeenCalledOnce(); expect(mocks.preview).toHaveBeenCalledOnce(); expect(mocks.apply).toHaveBeenCalledOnce();
    expect(crypto.randomUUID).toHaveBeenCalledOnce(); fireEvent.click(screen.getByRole('button', { name: action.ui.check_status_label }));
    await screen.findByText(action.ui.success_message); expect(mocks.status).toHaveBeenCalledExactlyOnceWith(preview(), key, expect.any(Function));
  });
  it('refuses a write if its recovery reference cannot be stored', async () => {
    render(<SurveyRelocationPanel {...props()} />); await reviewSelection(); vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('storage blocked'); });
    fireEvent.click(confirm()); await screen.findByText(/No pudimos conservar la referencia de esta operación/); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('preserves selection after a confirmed conflict and requires a new explicit preview', async () => {
    mocks.apply.mockRejectedValueOnce(new ApiError('revision_conflict', 409)); render(<SurveyRelocationPanel {...props()} />); await reviewSelection(); fireEvent.click(confirm());
    await screen.findByText(action.ui.conflict_message);
    expect(screen.getAllByRole('checkbox').every(box => (box as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole('combobox')).toHaveValue(String(target.id));
    expect(mocks.preview).toHaveBeenCalledOnce(); expect(mocks.apply).toHaveBeenCalledOnce(); expect(confirm).toThrow();
    fireEvent.click(screen.getByRole('button', { name: action.ui.preview_label })); await screen.findByText(preview().ui.preservation_notice);
    expect(mocks.preview).toHaveBeenCalledTimes(2); expect(mocks.apply).toHaveBeenCalledOnce();
  });
  it.each(['actor', 'tenant', 'role', 'profile'] as const)('retires a late preview after changing the %s', async kind => {
    const pending = deferred<RelocationPreview>(); mocks.preview.mockReturnValueOnce(pending.promise); const p = props(), view = render(<SurveyRelocationPanel {...p} />);
    const dialog = await openAndSelect(); fireEvent.click(within(dialog).getByRole('button', { name: action.ui.preview_label }));
    const current = mocks.preview.mock.calls[0][3] as () => boolean; expect(current()).toBe(true);
    if (kind === 'actor') mocks.session.user.id = 'replacement-superadmin';
    if (kind === 'role') mocks.session.user.rol = 'admin_municipio';
    if (kind === 'profile') mocks.session.organizationProfileVerified = false;
    const next = kind === 'tenant' ? { ...p, tenantSlug: target.slug, surveys: { ...list(), tenant: target } } : p;
    view.rerender(<SurveyRelocationPanel {...next} />); expect(current()).toBe(false);
    await act(async () => pending.resolve(preview())); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it('retires logout before a rerender and does not display an eventual POST receipt', async () => {
    const pending = deferred<RelocationReceipt>(); mocks.apply.mockReturnValueOnce(pending.promise); render(<SurveyRelocationPanel {...props()} />); await reviewSelection(); fireEvent.click(confirm());
    const current = mocks.apply.mock.calls[0][2] as () => boolean; expect(current()).toBe(true); advanceChatbocSessionRevision(); expect(current()).toBe(false);
    await act(async () => pending.resolve(receipt())); expect(screen.queryByText(action.ui.success_message)).not.toBeInTheDocument(); expect(mocks.apply).toHaveBeenCalledOnce();
  });
});
