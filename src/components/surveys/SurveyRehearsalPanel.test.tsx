import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { rehearsal, rehearsalKey as key, rehearsalList as list, rehearsalTenant as tenant } from '../../../tests/fixtures/survey-rehearsal.synthetic';
import type { Rehearsal } from '@/api/surveyRehearsals';
const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), status: vi.fn(), session: { user: { id: 'synthetic-SA', rol: 'superadmin' }, hasVerifiedSession: true, organizationProfileVerified: true } }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => mocks.session }));
vi.mock('@/api/surveyRehearsals', async original => ({ ...await original<typeof import('@/api/surveyRehearsals')>(), listRehearsals: mocks.list, createRehearsal: mocks.create, getRehearsalCreationStatus: mocks.status }));
import { SurveyRehearsalPanel } from './SurveyRehearsalPanel';
beforeEach(() => { sessionStorage.clear(); mocks.session = { user: { id: 'synthetic-SA', rol: 'superadmin' }, hasVerifiedSession: true, organizationProfileVerified: true }; mocks.list.mockReset().mockResolvedValue(list()); mocks.create.mockReset().mockResolvedValue(rehearsal()); mocks.status.mockReset().mockResolvedValue(rehearsal()); vi.spyOn(crypto, 'randomUUID').mockReturnValue(key); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const props = { tenantSlug: tenant, listReady: true };
const createButton = async () => screen.findByRole('button', { name: list().create_action.ui.label });
describe('verified SA persistent rehearsal administration', () => {
  it('creates only after the real scoped descriptor and shows the product link and nonofficial warning', async () => {
    render(<SurveyRehearsalPanel {...props} />); const button = await createButton(); expect(mocks.create).not.toHaveBeenCalled(); fireEvent.click(button);
    const link = await screen.findByRole('link', { name: list().ui.open_label }); expect(link).toHaveAttribute('href', `/pruebas/encuestas/${tenant}/${rehearsal().run_id}`); expect(screen.getByText(list().ui.warning)).toBeVisible();
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(list(), key, expect.any(Function));
  });
  it.each(['session', 'profile', 'list scope', 'invalid tenant'])('makes no requests without %s authority', reason => {
    if (reason === 'session') mocks.session.hasVerifiedSession = false; if (reason === 'profile') mocks.session.organizationProfileVerified = false;
    const view = render(<SurveyRehearsalPanel {...props} listReady={reason !== 'list scope'} tenantSlug={reason === 'invalid tenant' ? '../bad' : tenant} />); expect(view.container).toBeEmptyDOMElement(); expect(mocks.list).not.toHaveBeenCalled();
  });
  it('lets a verified ordinary administrator read their server-authorized board while creation remains denied', async () => {
    mocks.session.user.rol = 'admin_municipio'; const owned = list(); owned.items = [rehearsal(2)]; owned.create_action.can_create = false; owned.create_action.blocked_reason_code = 'rehearsal_superadmin_required'; mocks.list.mockResolvedValueOnce(owned);
    render(<SurveyRehearsalPanel {...props} />); expect(await createButton()).toBeDisabled(); expect(screen.getByText(/Participaciones guardadas: 2/)).toBeVisible(); expect(mocks.list).toHaveBeenCalledExactlyOnceWith(tenant, expect.any(Function)); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('respects a server-denied create, including strict assurance or license gates', async () => {
    const denied = list(); denied.create_action.can_create = false; denied.create_action.blocked_reason_code = 'strict_mfa_required'; mocks.list.mockResolvedValueOnce(denied);
    render(<SurveyRehearsalPanel {...props} />); expect(await createButton()).toBeDisabled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('sends one POST while pending and rejects an eventual result after logout', async () => {
    let resolve!: (value: Rehearsal) => void; mocks.create.mockReturnValueOnce(new Promise<Rehearsal>(done => { resolve = done; })); render(<SurveyRehearsalPanel {...props} />);
    const button = await createButton(); fireEvent.click(button); fireEvent.click(button); expect(mocks.create).toHaveBeenCalledOnce(); const current = mocks.create.mock.calls[0][2] as () => boolean;
    advanceChatbocSessionRevision(); expect(current()).toBe(false); await act(async () => resolve(rehearsal())); expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('recovers uncertain creation on remount via GET only, including a missing receipt', async () => {
    mocks.create.mockRejectedValueOnce(new ApiError('gateway', 503)); mocks.status.mockRejectedValueOnce(new ApiError('not observed', 404)); const view = render(<SurveyRehearsalPanel {...props} />); fireEvent.click(await createButton()); await screen.findByText(list().ui.uncertain_message); view.unmount();
    render(<SurveyRehearsalPanel {...props} />); fireEvent.click(await screen.findByRole('button', { name: list().ui.check_status_label })); await waitFor(() => expect(mocks.status).toHaveBeenCalledExactlyOnceWith(tenant, key, expect.any(Function)));
    expect(screen.queryByRole('button', { name: list().create_action.ui.label })).not.toBeInTheDocument(); expect(mocks.create).toHaveBeenCalledOnce(); expect(crypto.randomUUID).toHaveBeenCalledOnce();
  });
});
