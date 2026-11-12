import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import type { Rehearsal, RehearsalResponse } from '@/api/surveyRehearsals';
import { rehearsal as data, rehearsalAccount as account, rehearsalResponse as receipt, rehearsalKey as key, rehearsalTenant as tenant, rehearsalRun as run } from '../../../tests/fixtures/survey-rehearsal.synthetic';
const mocks = vi.hoisted(() => ({ read: vi.fn(), account: vi.fn(), respond: vi.fn(), status: vi.fn(), session: { user: { id: 'synthetic-account', rol: 'ciudadano' }, hasVerifiedSession: true } }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => mocks.session }));
vi.mock('@/api/surveyRehearsals', async original => ({ ...await original<typeof import('@/api/surveyRehearsals')>(), getRehearsal: mocks.read, getRehearsalAccountStatus: mocks.account, respondToRehearsal: mocks.respond, getRehearsalResponseStatus: mocks.status }));
import { PublicSurveyRehearsal } from './RehearsalPage';
beforeEach(() => { sessionStorage.clear(); mocks.session = { user: { id: 'synthetic-account', rol: 'ciudadano' }, hasVerifiedSession: true }; mocks.read.mockReset().mockImplementation(async () => data()); mocks.account.mockReset().mockResolvedValue(account()); mocks.respond.mockReset().mockResolvedValue(receipt()); mocks.status.mockReset().mockResolvedValue(receipt()); vi.spyOn(crypto, 'randomUUID').mockReturnValue(key); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const props = { tenantSlug: tenant, runId: run };
const ready = async () => { await screen.findByRole('radio', { name: 'Sí' }); await waitFor(() => expect(screen.getByRole('radio', { name: 'Sí' })).toBeEnabled()); };
const choose = async () => { await ready(); fireEvent.click(screen.getByRole('radio', { name: 'Sí' })); };
const send = () => screen.getByRole('button', { name: data().ui.submit_label });
describe('ordinary real-account rehearsal route', () => {
  it('renders real tenant branding and separated counts, then accepts only its own bound receipt', async () => {
    render(<PublicSurveyRehearsal {...props} />); await choose(); expect(screen.getByText(data().branding.display_name)).toBeVisible(); expect(screen.getByText(data().ui.warning)).toBeVisible(); expect(screen.getByText(/Participaciones guardadas: 0/)).toBeVisible(); expect(mocks.respond).not.toHaveBeenCalled();
    fireEvent.click(send()); await screen.findByRole('status'); expect(mocks.respond).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ run_id: run, tenant_slug: tenant }), key, 'yes', expect.any(Function)); expect(send).toThrow();
  });
  it('uses server participation even on a clean browser storage reload to inhibit a second vote', async () => {
    mocks.account.mockResolvedValueOnce(account(true)); render(<PublicSurveyRehearsal {...props} />); await screen.findByText(account(true).ui.label);
    expect(screen.getByRole('radio', { name: 'Sí' })).toBeDisabled(); expect(send()).toBeDisabled(); expect(mocks.respond).not.toHaveBeenCalled(); expect(mocks.account).toHaveBeenCalledOnce();
  });
  it('requires a successful private account status before enabling participation', async () => {
    let resolve!: (value: ReturnType<typeof account>) => void; mocks.account.mockReturnValueOnce(new Promise(done => { resolve = done; })); render(<PublicSurveyRehearsal {...props} />);
    await screen.findByRole('radio', { name: 'Sí' }); expect(screen.getByRole('radio', { name: 'Sí' })).toBeDisabled(); await act(async () => resolve(account())); expect(screen.getByRole('radio', { name: 'Sí' })).toBeEnabled();
  });
  it('does not infer own participation from aggregate totals after an uncertain POST', async () => {
    mocks.respond.mockRejectedValueOnce(new ApiError('gateway', 503)); mocks.read.mockImplementation(async () => data(2)); mocks.status.mockRejectedValueOnce(new ApiError('not observed', 404)); render(<PublicSurveyRehearsal {...props} />); await choose(); fireEvent.click(send());
    await screen.findByText(data().ui.uncertain_message); fireEvent.click(screen.getByRole('button', { name: data().ui.check_status_label })); await waitFor(() => expect(mocks.status).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: data().ui.submit_label })).not.toBeInTheDocument(); expect(screen.queryByText(receipt().ui.label, { exact: false })).not.toBeInTheDocument(); expect(mocks.respond).toHaveBeenCalledOnce();
  });
  it('retains one uncertain intent through reload and checks only the same account/key', async () => {
    mocks.respond.mockRejectedValueOnce(new TypeError('network')); const view = render(<PublicSurveyRehearsal {...props} />); await choose(); fireEvent.click(send()); await screen.findByText(data().ui.uncertain_message); view.unmount();
    render(<PublicSurveyRehearsal {...props} />); fireEvent.click(await screen.findByRole('button', { name: data().ui.check_status_label })); await screen.findByRole('status');
    expect(mocks.status).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ tenant_slug: tenant, run_id: run }), key, 'yes', expect.any(Function)); expect(mocks.respond).toHaveBeenCalledOnce(); expect(crypto.randomUUID).toHaveBeenCalledOnce();
  });
  it('shows login with a scoped return path and sends nothing for an unverified account', async () => {
    mocks.session.hasVerifiedSession = false; render(<PublicSurveyRehearsal {...props} />); const link = await screen.findByRole('link', { name: data().ui.login_label });
    expect(new URL(link.getAttribute('href')!, 'https://synthetic.invalid').searchParams.get('next')).toBe(`/pruebas/encuestas/${tenant}/${run}`); expect(mocks.account).not.toHaveBeenCalled(); expect(mocks.respond).not.toHaveBeenCalled();
  });
  it('refuses duplicate clicks while pending and retires a late receipt on logout', async () => {
    let resolve!: (value: RehearsalResponse) => void; mocks.respond.mockReturnValueOnce(new Promise<RehearsalResponse>(done => { resolve = done; })); render(<PublicSurveyRehearsal {...props} />); await choose(); const button = send(); fireEvent.click(button); fireEvent.click(button); expect(mocks.respond).toHaveBeenCalledOnce();
    const current = mocks.respond.mock.calls[0][3] as () => boolean; advanceChatbocSessionRevision(); expect(current()).toBe(false); await act(async () => resolve(receipt())); expect(screen.queryByText(receipt().ui.label, { exact: false })).not.toBeInTheDocument();
  });
  it('replaces neither the route nor actor with a late private account response', async () => {
    let resolve!: (value: ReturnType<typeof account>) => void; mocks.account.mockReturnValueOnce(new Promise(done => { resolve = done; })); const view = render(<PublicSurveyRehearsal {...props} />); await screen.findByRole('radio', { name: 'Sí' });
    const current = mocks.account.mock.calls[0][1] as () => boolean; mocks.session.user.id = 'replacement-account'; mocks.account.mockResolvedValueOnce(account()); view.rerender(<PublicSurveyRehearsal {...props} />); expect(current()).toBe(false); await act(async () => resolve(account(true))); expect(screen.queryByText(account(true).ui.label)).not.toBeInTheDocument();
  });
  it('polls persisted counts once per interval, shows reading time, and stops old polling on revision retirement', async () => {
    vi.useFakeTimers(); mocks.read.mockResolvedValueOnce(data()).mockResolvedValueOnce(data(2)); render(<PublicSurveyRehearsal {...props} />); await act(async () => {});
    expect(screen.getByText(/Participaciones guardadas: 0/)).toBeVisible(); expect(document.querySelector('time')?.getAttribute('datetime')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(screen.getByText(/Participaciones guardadas: 2/)).toBeVisible(); expect(mocks.read).toHaveBeenCalledTimes(2);
    advanceChatbocSessionRevision(); await act(async () => { await vi.advanceTimersByTimeAsync(6000); }); expect(mocks.read).toHaveBeenCalledTimes(2); expect(mocks.respond).not.toHaveBeenCalled();
  });
  it('does not overwrite a replacement route with a late public response', async () => {
    let resolve!: (value: Rehearsal) => void; mocks.read.mockReturnValueOnce(new Promise<Rehearsal>(done => { resolve = done; })); const view = render(<PublicSurveyRehearsal {...props} />);
    const current = mocks.read.mock.calls[0][2] as () => boolean; view.rerender(<PublicSurveyRehearsal {...props} runId="invalid" />); expect(current()).toBe(false); await act(async () => resolve(data())); expect(screen.queryByText(data().branding.display_name)).not.toBeInTheDocument();
  });
  it.each(['expiry', 'quota'])('inhibits participation for %s without making a POST', async reason => {
    const raw = data(reason === 'quota' ? 20 : 0); if (reason === 'expiry') raw.expires_at = new Date(Date.now() - 1000).toISOString(); mocks.read.mockResolvedValueOnce(raw);
    render(<PublicSurveyRehearsal {...props} />); await screen.findByRole('radio', { name: 'Sí' }); await waitFor(() => expect(mocks.account).toHaveBeenCalledOnce());
    expect(screen.getByRole('radio', { name: 'Sí' })).toBeDisabled(); expect(send()).toBeDisabled(); expect(mocks.respond).not.toHaveBeenCalled();
  });
  it('keeps read polling independent from a pending response and still accepts the own receipt', async () => {
    vi.useFakeTimers(); let resolve!: (value: RehearsalResponse) => void; mocks.respond.mockReturnValueOnce(new Promise<RehearsalResponse>(done => { resolve = done; }));
    render(<PublicSurveyRehearsal {...props} />); await act(async () => {}); fireEvent.click(screen.getByRole('radio', { name: 'Sí' })); fireEvent.click(send());
    const current = mocks.respond.mock.calls[0][3] as () => boolean; await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(current()).toBe(true);
    await act(async () => resolve(receipt())); expect(screen.getByRole('status')).toHaveTextContent(receipt().ui.label); expect(mocks.respond).toHaveBeenCalledOnce();
  });
});
