import React from 'react';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInput from './ChatInput';
import { useChatInputDraft } from './useChatInputDraft';
import { safeLocalStorage, safeSessionStorage } from '@/utils/safeLocalStorage';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { clearDemoRuntimeStorage } from '@/features/demo/demoStorage';
import { clearWidgetRuntimeCacheForTenantSwitch } from '@/utils/widgetTokenScope';

const field = () => screen.getByRole('textbox', { name: 'Escribir mensaje', exact: true });
const storedDrafts = () => Object.keys(localStorage).filter(key => key.startsWith('chat_widget_input_draft_v2:'));
const props = (tenant = 'qa-a', chat = 'qa-chat-a', demo = 'qa-demo-a') => ({ tenantSlug: tenant, chatSessionId: chat, demoSessionId: demo, isTyping: false, supportsMultimodalIntake: false, onSendMessage: vi.fn() });
beforeEach(() => {
  safeLocalStorage.clear(); safeSessionStorage.clear();
  vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('TextEncoder', TextEncoder);
  advanceChatbocSessionRevision();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); safeLocalStorage.clear(); safeSessionStorage.clear(); });

describe('ChatInput draft ownership', () => {
  it('keeps tenant drafts separate through the real cleanup and a remount on the same pathname', async () => {
    const user = userEvent.setup();
    const a = render(<ChatInput {...props()} />);
    await user.type(field(), 'draft A');
    await waitFor(() => expect(storedDrafts()).toHaveLength(1));
    a.unmount(); clearWidgetRuntimeCacheForTenantSwitch(); clearDemoRuntimeStorage();
    const b = render(<ChatInput {...props('qa-b', 'qa-chat-b', 'qa-demo-b')} />);
    expect(field()).toHaveValue('');
    await user.type(field(), 'draft B');
    await waitFor(() => expect(storedDrafts()).toHaveLength(2));
    b.unmount();
    render(<ChatInput {...props()} />);
    expect(field()).toHaveValue('draft A');
    expect(Object.values(localStorage)).toEqual(expect.arrayContaining(['draft A', 'draft B']));
    expect(screen.getByText(/Recuperamos tu borrador anterior/)).toBeInTheDocument();
    await user.click(field()); await user.keyboard('{Enter}');
    expect(field()).toHaveValue('');
    expect(screen.queryByText(/Recuperamos tu borrador anterior/)).not.toBeInTheDocument();
    expect(Object.values(localStorage)).toContain('draft B');
  });

  it.each(['chat', 'demo'])('retires the previous %s session without copying its draft on A to B to A', async identity => {
    const user = userEvent.setup(); const base = props();
    const view = render(<ChatInput {...base} />);
    await user.type(field(), 'original');
    view.rerender(<ChatInput {...base} {...(identity === 'chat' ? { chatSessionId: 'qa-chat-b' } : { demoSessionId: 'qa-demo-b' })} />);
    expect(field()).toHaveValue('');
    await user.type(field(), 'new session');
    view.rerender(<ChatInput {...base} />);
    expect(field()).toHaveValue('original');
    expect(base.onSendMessage).not.toHaveBeenCalled();
  });

  it('preserves an edited draft across an immediate remount while digest promises are pending and ignores retired completions', async () => {
    const pending: Array<() => void> = [];
    const nativeDigest = webcrypto.subtle.digest.bind(webcrypto.subtle);
    vi.spyOn(webcrypto.subtle, 'digest').mockImplementation((algorithm, data) => new Promise(resolve => {
      pending.push(() => { void nativeDigest(algorithm, data).then(resolve); });
    }));
    const user = userEvent.setup(); const a = render(<ChatInput {...props()} />);
    await user.type(field(), 'typed before SHA'); a.unmount();
    const b = render(<ChatInput {...props('qa-b', 'qa-chat-b', 'qa-demo-b')} />);
    await user.type(field(), 'B stays');
    await act(async () => { pending[0](); await Promise.resolve(); });
    expect(field()).toHaveValue('B stays');
    b.unmount(); render(<ChatInput {...props()} />);
    expect(field()).toHaveValue('typed before SHA');
    await act(async () => { pending.slice(1).forEach(resolve => resolve()); });
    await waitFor(() => expect(Object.values(localStorage)).toContain('typed before SHA'));
    expect(Object.values(localStorage)).not.toContain('B stays');
  });

  it('rotates authority and does not restore its previous draft even with the same tenant and session identifiers', async () => {
    const user = userEvent.setup(); render(<ChatInput {...props()} />);
    await user.type(field(), 'old authority'); await waitFor(() => expect(storedDrafts()).toHaveLength(1));
    await act(async () => { advanceChatbocSessionRevision(); });
    expect(field()).toHaveValue('');
    await user.type(field(), 'new authority'); await waitFor(() => expect(storedDrafts()).toHaveLength(2));
    cleanup(); render(<ChatInput {...props()} />);
    expect(field()).toHaveValue('new authority');
  });

  it('never adopts or removes an ambiguous pathname legacy draft and never persists raw session credentials', async () => {
    safeLocalStorage.setItem('chat_widget_input_draft_v1:/', 'unowned legacy');
    const user = userEvent.setup(); render(<ChatInput {...props('qa-a', 'chat-exact', 'signed.dummy.session')} />);
    expect(field()).toHaveValue('');
    await user.type(field(), 'owned'); await waitFor(() => expect(storedDrafts()).toHaveLength(1));
    expect(storedDrafts()[0]).toMatch(/^chat_widget_input_draft_v2:[a-f\d]{64}$/);
    expect(JSON.stringify(localStorage)).not.toContain('signed.dummy.session');
    expect(safeLocalStorage.getItem('chat_widget_input_draft_v1:/')).toBe('unowned legacy');
  });

  it('uses a volatile draft when the tenant or bound chat session is missing', async () => {
    const user = userEvent.setup(); const view = render(<ChatInput {...props()} tenantSlug={null} />);
    await user.type(field(), 'unbound'); expect(storedDrafts()).toHaveLength(0);
    view.unmount(); render(<ChatInput {...props()} tenantSlug={null} />);
    expect(field()).toHaveValue('');
    cleanup(); render(<ChatInput {...props()} chatSessionId={null} />);
    await user.type(field(), 'also unbound'); expect(storedDrafts()).toHaveLength(0);
  });

  it('keeps input usable without WebCrypto while avoiding persistent keys', async () => {
    vi.stubGlobal('crypto', undefined);
    const user = userEvent.setup(); const view = render(<ChatInput {...props()} />);
    await user.type(field(), 'volatile'); expect(field()).toHaveValue('volatile');
    expect(storedDrafts()).toHaveLength(0);
    view.unmount(); render(<ChatInput {...props('qa-b', 'qa-chat-b', 'qa-demo-b')} />);
    expect(field()).toHaveValue('');
  });

  it('ignores an old owner clear callback after switching scope and clears only the current draft', async () => {
    const actions: Array<() => void> = [];
    function Harness({ tenant }: { tenant: string }) {
      const draft = useChatInputDraft({ tenantSlug: tenant, chatSessionId: 'exact-chat' });
      React.useEffect(() => { actions.push(draft.clearDraft); }, [draft.clearDraft]);
      return <input aria-label="controlled draft" value={draft.input} onChange={event => draft.setInput(event.target.value)} />;
    }
    const user = userEvent.setup(); const view = render(<Harness tenant="qa-a" />);
    await user.type(screen.getByRole('textbox'), 'A');
    const clearA = actions[0];
    view.rerender(<Harness tenant="qa-b" />); await user.type(screen.getByRole('textbox'), 'B');
    act(() => clearA()); expect(screen.getByRole('textbox')).toHaveValue('B');
    act(() => actions.at(-1)!()); expect(screen.getByRole('textbox')).toHaveValue('');
    view.rerender(<Harness tenant="qa-a" />); expect(screen.getByRole('textbox')).toHaveValue('A');
  });

  it('keeps the committed draft owner active when a transition to another tenant suspends before commit', async () => {
    const pending = new Promise<never>(() => {});
    function Harness({ tenant, suspend = false }: { tenant: string; suspend?: boolean }) {
      const draft = useChatInputDraft({ tenantSlug: tenant, chatSessionId: 'exact-chat' });
      if (suspend) throw pending;
      return <input aria-label="committed draft" value={draft.input} onChange={event => draft.setInput(event.target.value)} />;
    }
    const wrap = (tenant: string, suspend = false) => <React.Suspense fallback={<p>Pending</p>}><Harness tenant={tenant} suspend={suspend} /></React.Suspense>;
    const user = userEvent.setup(); const view = render(wrap('qa-a'));
    await user.type(screen.getByRole('textbox'), 'A');
    act(() => { React.startTransition(() => view.rerender(wrap('qa-b', true))); });
    expect(screen.getByRole('textbox')).toHaveValue('A');
    await user.type(screen.getByRole('textbox'), ' stays');
    expect(screen.getByRole('textbox')).toHaveValue('A stays');
    view.rerender(wrap('qa-a'));
    expect(screen.getByRole('textbox')).toHaveValue('A stays');
  });
});
