import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInput from './ChatInput';
import { uploadChatAttachment } from '@/features/chat/uploadChatAttachment';
import { safeLocalStorage, safeSessionStorage } from '@/utils/safeLocalStorage';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { toast } from '@/components/ui/use-toast';

vi.mock('@/features/chat/uploadChatAttachment', () => ({ uploadChatAttachment: vi.fn(), createChatAttachmentUploadAttempt: vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/utils/api', () => ({ getErrorMessage: (error: unknown) => error instanceof Error ? error.message : 'fixture error' }));
vi.mock('@/hooks/useAudioRecorder', () => ({
  default: () => ({ isRecording: false, isStarting: false, startRecording: vi.fn(), stopRecording: vi.fn(), cancelRecording: vi.fn(), captureRecordingOwner: vi.fn() }),
  recordedAudioFilename: () => 'fixture.webm',
}));

const field = () => screen.getByRole('textbox', { name: 'Escribir mensaje', exact: true });
const sendButton = () => screen.getByRole('button', { name: 'Enviar mensaje', exact: true });
const base = { isTyping: false, tenantSlug: 'fixture-upload-a', demoSessionId: 'fixture-demo-a', chatSessionId: 'fixture-chat-a',
  mediaCapabilities: { input_modes: { file: { enabled: true, accept: ['application/pdf'] } } } };
const response = { attachmentInfo: { url: 'https://objects.example.test/synthetic.pdf', name: 'synthetic.pdf', mimeType: 'application/pdf', size: 3 } };
const deferred = () => {
  let resolve!: (value: typeof response) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<typeof response>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const attach = (container: HTMLElement) => {
  fireEvent.click(screen.getByRole('button', { name: 'Adjuntar archivo', exact: true }));
  const file = new File(['pdf'], 'synthetic.pdf', { type: 'application/pdf' });
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
};
beforeEach(() => { safeLocalStorage.clear(); safeSessionStorage.clear(); vi.mocked(uploadChatAttachment).mockReset(); vi.mocked(toast).mockClear(); });
afterEach(() => { cleanup(); safeLocalStorage.clear(); safeSessionStorage.clear(); });

describe('real ChatInput with explicit deferred upload seam; no HTTP', () => {
  it('retires upload A after changing to B without calling an old sender or clearing B', async () => {
    const pending = deferred(); vi.mocked(uploadChatAttachment).mockReturnValueOnce(pending.promise);
    const oldSend = vi.fn(), nextSend = vi.fn();
    const view = render(<ChatInput {...base} onSendMessage={oldSend} />);
    fireEvent.change(field(), { target: { value: 'Draft A' } }); attach(view.container); fireEvent.click(sendButton());
    expect(uploadChatAttachment).toHaveBeenCalledTimes(1);
    view.rerender(<ChatInput {...base} tenantSlug="fixture-upload-b" chatSessionId="fixture-chat-b" onSendMessage={nextSend} />);
    fireEvent.change(field(), { target: { value: 'New draft B' } });
    await act(async () => { pending.resolve(response); await pending.promise; });
    expect(oldSend).not.toHaveBeenCalled(); expect(nextSend).not.toHaveBeenCalled(); expect(field()).toHaveValue('New draft B');
  });

  it('allows only one upload and one send for two clicks while upload remains pending', async () => {
    const first = deferred(), second = deferred();
    vi.mocked(uploadChatAttachment).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const send = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={send} />);
    fireEvent.change(field(), { target: { value: 'One intended message' } }); attach(view.container);
    fireEvent.click(sendButton()); fireEvent.click(sendButton());
    const pendingUploads = vi.mocked(uploadChatAttachment).mock.calls.length;
    await act(async () => { first.resolve(response); second.resolve(response); await Promise.all([first.promise, second.promise]); });
    expect(pendingUploads).toBe(1); expect(send).toHaveBeenCalledTimes(1);
  });

  it('preserves text edited during upload in the same conversation', async () => {
    const pending = deferred(); vi.mocked(uploadChatAttachment).mockReturnValueOnce(pending.promise);
    const send = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={send} />);
    fireEvent.change(field(), { target: { value: 'Original submitted text' } }); attach(view.container); fireEvent.click(sendButton());
    fireEvent.change(field(), { target: { value: 'New unsent edit' } });
    await act(async () => { pending.resolve(response); await pending.promise; });
    expect(send).toHaveBeenCalledTimes(1); expect(send).toHaveBeenCalledWith(expect.objectContaining({ text: 'Original submitted text' }));
    expect(field()).toHaveValue('New unsent edit');
  });

  it('preserves an unsuccessful attachment and draft until an explicit retry', async () => {
    const pending = deferred(); vi.mocked(uploadChatAttachment).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const send = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={send} />);
    fireEvent.change(field(), { target: { value: 'Keep this draft' } }); attach(view.container); fireEvent.click(sendButton());
    await act(async () => { pending.reject(new Error('Synthetic transport failure')); await pending.promise.catch(() => {}); });
    expect(send).not.toHaveBeenCalled(); expect(uploadChatAttachment).toHaveBeenCalledTimes(1);
    expect(field()).toHaveValue('Keep this draft'); expect(screen.getByRole('button', { name: 'Quitar adjunto' })).toBeInTheDocument();
    expect(sendButton()).not.toHaveAttribute('aria-busy', 'true');
    await act(async () => { fireEvent.click(sendButton()); });
    expect(uploadChatAttachment).toHaveBeenCalledTimes(2); expect(send).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });

  it.each(['remove', 'replace-same-name'] as const)('retires an upload when its attachment changes: %s', async change => {
    const pending = deferred(); vi.mocked(uploadChatAttachment).mockReturnValueOnce(pending.promise);
    const send = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={send} />);
    fireEvent.change(field(), { target: { value: 'Unsent comment' } }); attach(view.container); fireEvent.click(sendButton());
    const uploadCurrent = vi.mocked(uploadChatAttachment).mock.calls[0][2]?.isCurrent;
    expect(uploadCurrent?.()).toBe(true);
    if (change === 'remove') fireEvent.click(screen.getByRole('button', { name: 'Quitar adjunto' }));
    else attach(view.container); // A distinct File object with the very same name.
    expect(uploadCurrent?.()).toBe(false);
    await act(async () => { pending.resolve(response); await pending.promise; });
    expect(send).not.toHaveBeenCalled(); expect(field()).toHaveValue('Unsent comment');
    expect(sendButton()).not.toHaveAttribute('aria-busy', 'true');
    if (change !== 'remove') expect(screen.getByRole('button', { name: 'Quitar adjunto' })).toBeInTheDocument();
  });

  it('does not let an ABA context change revive an old upload or unlock a new one', async () => {
    const first = deferred(), second = deferred(); vi.mocked(uploadChatAttachment).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const oldSend = vi.fn(), nextSend = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={oldSend} />);
    attach(view.container); fireEvent.click(sendButton());
    view.rerender(<ChatInput {...base} tenantSlug="fixture-upload-b" onSendMessage={nextSend} />);
    view.rerender(<ChatInput {...base} onSendMessage={nextSend} />);
    attach(view.container);
    fireEvent.click(sendButton());
    expect(uploadChatAttachment).toHaveBeenCalledTimes(2);
    await act(async () => { first.resolve(response); await first.promise; });
    expect(oldSend).not.toHaveBeenCalled(); expect(nextSend).not.toHaveBeenCalled(); expect(sendButton()).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(sendButton()); expect(uploadChatAttachment).toHaveBeenCalledTimes(2);
    await act(async () => { second.resolve(response); await second.promise; });
    expect(nextSend).toHaveBeenCalledTimes(1); expect(sendButton()).not.toHaveAttribute('aria-busy', 'true');
  });

  it.each(['session-revoked', 'unmount', 'disabled'] as const)('ignores a delayed result after %s', async change => {
    const pending = deferred(); vi.mocked(uploadChatAttachment).mockReturnValueOnce(pending.promise);
    const send = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={send} />);
    attach(view.container); fireEvent.click(sendButton());
    if (change === 'session-revoked') act(() => { advanceChatbocSessionRevision(); });
    else if (change === 'unmount') view.unmount();
    else view.rerender(<ChatInput {...base} disabled onSendMessage={send} />);
    vi.mocked(toast).mockClear();
    await act(async () => { pending.resolve(response); await pending.promise; });
    expect(send).not.toHaveBeenCalled(); expect(toast).not.toHaveBeenCalled();
  });

  it('keeps voluntary focus outside the composer after the delayed upload', async () => {
    const pending = deferred(); vi.mocked(uploadChatAttachment).mockReturnValueOnce(pending.promise);
    const send = vi.fn(); const view = render(<><ChatInput {...base} onSendMessage={send} /><button>Another control</button></>);
    attach(view.container); sendButton().focus(); fireEvent.click(sendButton());
    const other = screen.getByRole('button', { name: 'Another control' }); other.focus();
    await act(async () => { pending.resolve(response); await pending.promise; });
    expect(send).toHaveBeenCalledTimes(1); expect(other).toHaveFocus();
  });

  it('keeps committed A valid when a B render suspends without committing', async () => {
    const pending = deferred(); vi.mocked(uploadChatAttachment).mockReturnValueOnce(pending.promise);
    const send = vi.fn(); const never = new Promise<never>(() => {});
    const Gate = ({ suspend }: { suspend: boolean }) => { if (suspend) throw never; return null; };
    const Harness = ({ next = false }: { next?: boolean }) => <React.Suspense fallback={<div>Waiting fixture</div>}>
      <ChatInput {...base} tenantSlug={next ? 'fixture-upload-b' : base.tenantSlug} onSendMessage={send} /><Gate suspend={next} />
    </React.Suspense>;
    const view = render(<Harness />); attach(view.container); fireEvent.click(sendButton());
    act(() => { React.startTransition(() => { view.rerender(<Harness next />); }); });
    await act(async () => { pending.resolve(response); await pending.promise; });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(['tenant', 'demo', 'conversation'] as const)('clears attachment ownership on a committed %s change without importing A into a fresh B send', async change => {
    const pending = deferred(); vi.mocked(uploadChatAttachment).mockReturnValueOnce(pending.promise);
    const oldSend = vi.fn(), nextSend = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={oldSend} />);
    attach(view.container); fireEvent.click(sendButton());
    const next = change === 'tenant' ? { ...base, tenantSlug: 'fixture-upload-b' }
      : change === 'demo' ? { ...base, demoSessionId: 'fixture-demo-b' } : { ...base, chatSessionId: 'fixture-chat-b' };
    view.rerender(<ChatInput {...next} onSendMessage={nextSend} />);
    expect(screen.queryByRole('button', { name: 'Quitar adjunto' })).not.toBeInTheDocument();
    fireEvent.change(field(), { target: { value: 'Only B text' } });
    await act(async () => { fireEvent.click(sendButton()); pending.resolve(response); await pending.promise; });
    expect(uploadChatAttachment).toHaveBeenCalledTimes(1); expect(oldSend).not.toHaveBeenCalled();
    expect(nextSend).toHaveBeenCalledWith(expect.objectContaining({ text: 'Only B text', attachmentInfo: undefined }));
  });

  it('does not upload after the selected mode is withdrawn before a fresh send', async () => {
    const send = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={send} />); attach(view.container);
    view.rerender(<ChatInput {...base} mediaCapabilities={{ input_modes: { file: { enabled: false }, image: { enabled: false } } }} onSendMessage={send} />);
    await act(async () => { fireEvent.click(sendButton()); });
    expect(uploadChatAttachment).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
    expect(sendButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('checks current size policy again before upload and keeps the rejected attachment for removal', async () => {
    const send = vi.fn(); const view = render(<ChatInput {...base} mediaCapabilities={{ input_modes: { file: { enabled: true, accept: ['application/pdf'], max_file_mb: 10 } } }} onSendMessage={send} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adjuntar archivo', exact: true }));
    fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File([new Uint8Array(2 * 1024 * 1024)], 'synthetic.pdf', { type: 'application/pdf' })] } });
    view.rerender(<ChatInput {...base} mediaCapabilities={{ input_modes: { file: { enabled: true, accept: ['application/pdf'], max_file_mb: 1 } } }} onSendMessage={send} />);
    fireEvent.click(sendButton());
    expect(uploadChatAttachment).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('El archivo supera el limite permitido de 1 MB.');
    expect(screen.getByRole('button', { name: 'Quitar adjunto' })).toBeInTheDocument();
  });

  it('revokes the old image preview URL when a committed binding change clears it', () => {
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:synthetic-a' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    try {
      const view = render(<ChatInput {...base} onSendMessage={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Adjuntar archivo', exact: true }));
      fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(['png'], 'synthetic.png', { type: 'image/png' })] } });
      view.rerender(<ChatInput {...base} tenantSlug="fixture-upload-b" onSendMessage={vi.fn()} />);
      expect(revoke).toHaveBeenCalledWith('blob:synthetic-a');
      expect(screen.queryByRole('button', { name: 'Quitar adjunto' })).not.toBeInTheDocument();
    } finally {
      if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor); else delete (URL as Partial<typeof URL>).createObjectURL;
      if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor); else delete (URL as Partial<typeof URL>).revokeObjectURL;
    }
  });

  it('does not show an old upload error or clear a newly selected B attachment', async () => {
    const pending = deferred(); vi.mocked(uploadChatAttachment).mockReturnValueOnce(pending.promise);
    const send = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={send} />); attach(view.container); fireEvent.click(sendButton());
    view.rerender(<ChatInput {...base} tenantSlug="fixture-upload-b" onSendMessage={send} />); attach(view.container);
    fireEvent.change(field(), { target: { value: 'B draft' } }); vi.mocked(toast).mockClear();
    await act(async () => { pending.reject(new Error('Synthetic stale failure')); await pending.promise.catch(() => {}); });
    expect(send).not.toHaveBeenCalled(); expect(toast).not.toHaveBeenCalled();
    expect(field()).toHaveValue('B draft'); expect(screen.getByRole('button', { name: 'Quitar adjunto' })).toBeInTheDocument();
  });

  it('retires a selected file on session revocation before any pending upload or new send', async () => {
    const send = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={send} />); attach(view.container);
    act(() => { advanceChatbocSessionRevision(); });
    expect(screen.queryByRole('button', { name: 'Quitar adjunto' })).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(sendButton()); });
    expect(uploadChatAttachment).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });

  it('clears a removed attachment error while preserving unrelated input validation', async () => {
    const send = vi.fn(); const view = render(<ChatInput {...base} mediaCapabilities={{ input_modes: { file: { enabled: true, accept: ['application/pdf'], max_file_mb: 10 } } }} onSendMessage={send} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adjuntar archivo', exact: true }));
    fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File([new Uint8Array(2 * 1024 * 1024)], 'synthetic.pdf', { type: 'application/pdf' })] } });
    view.rerender(<ChatInput {...base} mediaCapabilities={{ input_modes: { file: { enabled: true, accept: ['application/pdf'], max_file_mb: 1 } } }} onSendMessage={send} />);
    fireEvent.click(sendButton()); expect(screen.getByRole('alert')).toHaveTextContent('El archivo supera el limite permitido de 1 MB.');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar adjunto' }));
    expect(screen.getByRole('alert')).toBeEmptyDOMElement(); expect(field()).not.toHaveAttribute('aria-describedby');

    view.rerender(<ChatInput {...base} onSendMessage={send} validateBeforeSend={() => 'Synthetic input validation'} />);
    vi.mocked(uploadChatAttachment).mockResolvedValueOnce(response);
    attach(view.container); fireEvent.change(field(), { target: { value: 'Invalid text' } });
    await act(async () => { fireEvent.click(sendButton()); });
    expect(field()).toHaveAccessibleDescription('Synthetic input validation');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar adjunto' }));
    expect(field()).toHaveAccessibleDescription('Synthetic input validation');
    expect(send).not.toHaveBeenCalled();
  });
});
