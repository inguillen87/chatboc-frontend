import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChatComposer from './ChatComposer';
import { uploadChatAttachment } from './uploadChatAttachment';

vi.mock('./uploadChatAttachment', () => ({
  uploadChatAttachment: vi.fn(),
}));

vi.mock('@/hooks/useAudioRecorder', () => ({
  default: () => ({
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  }),
}));

describe('ChatComposer attachment validation', () => {
  beforeEach(() => {
    vi.mocked(uploadChatAttachment).mockReset();
  });

  it('uses explicit accessible foreground and background colors for the message field', () => {
    render(<ChatComposer onSend={vi.fn()} />);

    expect(screen.getByLabelText('Mensaje')).toHaveClass(
      'bg-background',
      'text-foreground',
      'placeholder:text-muted-foreground',
    );
  });

  it('blocks unsupported public widget files before upload', async () => {
    render(
      <ChatComposer
        onSend={vi.fn()}
        mediaCapabilities={{
          composer: {
            actions: [{ id: 'file', type: 'file', label: 'Adjuntar archivo' }],
          },
          input_modes: {
            file: {
              enabled: true,
              upload_endpoint: '/archivos/upload/chat_attachment',
              accepted_mime_types: ['application/pdf'],
              accepted_extensions: ['.jpg'],
              max_file_mb: 5,
            },
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Adjuntar archivo/i }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const executable = new File(['binary'], 'setup.exe', { type: 'application/x-msdownload' });

    fireEvent.change(input, { target: { files: [executable] } });

    expect(await screen.findByText(/Formato no permitido/i)).toBeInTheDocument();
    expect(uploadChatAttachment).not.toHaveBeenCalled();
  });

  it('uploads a valid configured attachment', async () => {
    const onSend = vi.fn();
    vi.mocked(uploadChatAttachment).mockResolvedValueOnce({
      attachmentInfo: { url: 'https://cdn.example.com/boleta.pdf', name: 'boleta.pdf' },
    });

    render(
      <ChatComposer
        onSend={onSend}
        tenantSlug="municipio"
        demoSessionId="signed-demo-session"
        chatSessionId="sid_demo_session"
        mediaCapabilities={{
          composer: {
            actions: [{ id: 'file', type: 'file', label: 'Adjuntar archivo' }],
          },
          input_modes: {
            file: {
              enabled: true,
              upload_endpoint: '/archivos/upload/chat_attachment',
              accepted_mime_types: ['application/pdf'],
              max_file_mb: 5,
            },
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Adjuntar archivo/i }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(['pdf'], 'boleta.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [pdf] } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/i }));

    await waitFor(() => {
      expect(uploadChatAttachment).toHaveBeenCalled();
    });
    expect(uploadChatAttachment).toHaveBeenCalledWith(
      '/archivos/upload/chat_attachment',
      expect.any(Function),
      {
        tenantSlug: 'municipio',
        demoSessionId: 'signed-demo-session',
        chatSessionId: 'sid_demo_session',
      },
    );
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentInfo: { url: 'https://cdn.example.com/boleta.pdf', name: 'boleta.pdf' },
        attachmentFile: pdf,
      }),
    );
  });
});
