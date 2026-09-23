import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../tests/fixtures/private-conversation-guide.json';
import { apiFetch } from '@/utils/api';
import PrivateConversationGuide from './PrivateConversationGuide';
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
const api = vi.mocked(apiFetch);
const props = { value: fixture.access, tenant: fixture.access.tenant };
beforeEach(() => api.mockReset().mockResolvedValue(fixture.guide));
afterEach(cleanup);
describe('private conversation guide inside the organization workspace', () => {
  it('loads only after opening and sends explicit tenant with the selected code', async () => {
    render(<PrivateConversationGuide {...props} />); expect(api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: fixture.access.ui.open }));
    const heading = await screen.findByRole('heading', { name: fixture.guide.menu.title });
    expect(heading).toHaveFocus();
    expect(api).toHaveBeenCalledWith(fixture.access.endpoint + '?node=start', expect.objectContaining({ tenantSlug: 'acceptance-a', persistTenantSlug: false, cache: 'no-store' }));
    fireEvent.click(screen.getByRole('button', { name: 'Para mí' }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(api.mock.calls[1][0]).toBe(fixture.access.endpoint + '?node=start&selection=1');
  });
  it('removes previous content on access revocation and allows a clean retry', async () => {
    render(<PrivateConversationGuide {...props} />); fireEvent.click(screen.getByRole('button', { name: fixture.access.ui.open }));
    await screen.findByRole('heading', { name: fixture.guide.menu.title });
    api.mockRejectedValueOnce({ status: 403 });
    fireEvent.click(screen.getByRole('button', { name: fixture.access.ui.back_to_menu }));
    expect(screen.queryByText(fixture.guide.menu.text)).toBeNull();
    await screen.findByRole('alert'); expect(screen.queryByText(fixture.guide.menu.text)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: fixture.access.ui.start }));
    expect(await screen.findByRole('heading', { name: fixture.guide.menu.title })).toBeVisible();
  });
  it('does not render a late response after changing organizations', async () => {
    let resolve!: (v: unknown) => void;
    api.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const view = render(<PrivateConversationGuide {...props} />);
    fireEvent.click(screen.getByRole('button', { name: fixture.access.ui.open }));
    view.rerender(<PrivateConversationGuide {...props} tenant={{ id: 2, slug: 'acceptance-b' }} />);
    await act(async () => resolve(fixture.guide));
    expect(screen.queryByText(fixture.guide.menu.text)).toBeNull();
    expect(screen.queryByTestId('private-conversation-guide')).toBeNull();
  });
  it('rejects a wrong-scope reply without exposing its text', async () => {
    api.mockResolvedValueOnce({ ...fixture.guide, tenant: { id: 2, slug: 'acceptance-b' } });
    render(<PrivateConversationGuide {...props} />); fireEvent.click(screen.getByRole('button', { name: fixture.access.ui.open }));
    await screen.findByRole('alert'); expect(screen.queryByText(fixture.guide.menu.text)).toBeNull();
  });
  it('removes the guide while its parent refreshes or loses authority', async () => {
    const view = render(<PrivateConversationGuide {...props} />);
    fireEvent.click(screen.getByRole('button', { name: fixture.access.ui.open }));
    await screen.findByRole('heading', { name: fixture.guide.menu.title });
    view.rerender(<PrivateConversationGuide {...props} disabled />);
    expect(screen.queryByTestId('private-conversation-guide')).toBeNull();
  });
});
