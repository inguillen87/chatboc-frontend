import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChatInput from './ChatInput';
import { uploadChatAttachment } from '@/features/chat/uploadChatAttachment';

vi.mock('@/features/chat/uploadChatAttachment', () => ({
  uploadChatAttachment: vi.fn(),
}));

vi.mock('@/hooks/useAudioRecorder', () => ({
  default: () => ({
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  }),
}));

describe('ChatInput public demo upload context', () => {
  beforeEach(() => {
    vi.mocked(uploadChatAttachment).mockReset();
  });

  it('forwards the signed demo, tenant, and bound chat session to direct upload', async () => {
    const onSendMessage = vi.fn();
    vi.mocked(uploadChatAttachment).mockResolvedValueOnce({
      attachmentInfo: {
        url: 'https://objects.example.test/evidencia.pdf',
        name: 'evidencia.pdf',
        mimeType: 'application/pdf',
        size: 3,
      },
    });

    render(
      <ChatInput
        onSendMessage={onSendMessage}
        isTyping={false}
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
              upload_response_key: 'attachmentInfo',
              accept: ['application/pdf'],
            },
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Adjuntar archivo' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf'], 'evidencia.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => {
      expect(uploadChatAttachment).toHaveBeenCalledWith(
        '/archivos/upload/chat_attachment',
        expect.any(Function),
        {
          tenantSlug: 'municipio',
          demoSessionId: 'signed-demo-session',
          chatSessionId: 'sid_demo_session',
        },
      );
    });
    expect(onSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentInfo: expect.objectContaining({
          name: 'evidencia.pdf',
          mimeType: 'application/pdf',
        }),
      }),
    );
  });
});
