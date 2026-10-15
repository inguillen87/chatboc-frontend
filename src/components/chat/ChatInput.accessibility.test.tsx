import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInput from './ChatInput';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import type { SendPayload } from '@/types/chat';
import { uploadChatAttachment } from '@/features/chat/uploadChatAttachment';

vi.mock('@/features/chat/uploadChatAttachment', () => ({
  uploadChatAttachment: vi.fn(),
  createChatAttachmentUploadAttempt: vi.fn(),
}));

const emailError = 'Ingresá un email válido para continuar.';
const validateEmail = (payload: SendPayload) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.text.trim()) ? null : emailError;
const input = () => screen.getByRole('textbox', { name: 'Escribir mensaje', exact: true });
const errorDescription = (field: HTMLElement) => document.getElementById(field.getAttribute('aria-describedby')!);

beforeEach(() => { safeLocalStorage.clear(); vi.mocked(uploadChatAttachment).mockReset(); });
afterEach(() => { cleanup(); safeLocalStorage.clear(); });

describe('ChatInput accessible validation', () => {
  it('announces and associates a rejected message without sending, losing the draft or moving keyboard focus', async () => {
    const send = vi.fn();
    render(<ChatInput isTyping={false} onSendMessage={send} validateBeforeSend={validateEmail} />);
    const user = userEvent.setup();
    await user.type(input(), 'correo-incompleto'); await user.keyboard('{Enter}');
    expect(send).not.toHaveBeenCalled();
    expect(input()).toHaveValue('correo-incompleto');
    expect(input()).toHaveFocus();
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(errorDescription(input())).toHaveAttribute('role', 'alert');
    expect(errorDescription(input())).toHaveAttribute('aria-atomic', 'true');
    expect(input()).toHaveAccessibleDescription(emailError);
    expect(screen.queryByText('Mensaje listo para enviar')).not.toBeInTheDocument();
  });

  it('keeps error identifiers and descriptions independent for two mounted composers', async () => {
    render(<><ChatInput isTyping={false} onSendMessage={vi.fn()} validateBeforeSend={validateEmail} />
      <ChatInput isTyping={false} onSendMessage={vi.fn()} validateBeforeSend={validateEmail} /></>);
    const [first, second] = screen.getAllByRole('textbox', { name: 'Escribir mensaje', exact: true });
    const user = userEvent.setup();
    await user.type(first, 'primero'); await user.keyboard('{Enter}');
    expect(first).toHaveAccessibleDescription(emailError);
    expect(second).not.toHaveAttribute('aria-invalid', 'true');
    expect(second).not.toHaveAttribute('aria-describedby');
    const firstId = first.getAttribute('aria-describedby');
    await user.type(second, 'segundo'); await user.keyboard('{Enter}');
    expect(second).toHaveAccessibleDescription(emailError);
    expect(second.getAttribute('aria-describedby')).not.toBe(firstId);
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(2);
  });

  it('clears stale validation when editing and reuses its announcement region on another rejection and on success', async () => {
    const send = vi.fn();
    render(<ChatInput isTyping={false} onSendMessage={send} validateBeforeSend={validateEmail} />);
    const user = userEvent.setup();
    await user.type(input(), 'correo'); await user.keyboard('{Enter}');
    const region = errorDescription(input());
    expect(region).toHaveTextContent(emailError);
    await user.keyboard('x');
    expect(input()).toHaveValue('correox');
    expect(input()).not.toHaveAttribute('aria-invalid', 'true');
    expect(input()).not.toHaveAttribute('aria-describedby');
    expect(region).toBeEmptyDOMElement();
    await user.keyboard('{Enter}');
    expect(errorDescription(input())).toBe(region);
    expect(input()).toHaveAccessibleDescription(emailError);
    await user.clear(input()); await user.type(input(), 'persona@example.invalid'); await user.keyboard('{Enter}');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ text: 'persona@example.invalid', source: 'input' }));
    expect(input()).toHaveValue('');
    expect(input()).toHaveFocus();
    expect(input()).not.toHaveAttribute('aria-describedby');
    expect(region).toBeEmptyDOMElement();
  });

  it('retires the previous field error when the caller changes validation context, preserving its draft and focus', async () => {
    const send = vi.fn();
    const view = render(<ChatInput isTyping={false} tenantSlug="qa-widget" onSendMessage={send} validateBeforeSend={validateEmail} />);
    const user = userEvent.setup();
    await user.type(input(), 'borrador'); await user.keyboard('{Enter}');
    expect(screen.getByText(emailError)).toBeInTheDocument();
    const nextValidation = () => 'Ingresá un teléfono válido para continuar.';
    view.rerender(<ChatInput isTyping={false} tenantSlug="qa-widget" onSendMessage={send} validateBeforeSend={nextValidation} />);
    expect(screen.queryByText(emailError)).not.toBeInTheDocument();
    expect(input()).not.toHaveAttribute('aria-describedby');
    expect(input()).toHaveValue('borrador'); expect(input()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(input()).toHaveAccessibleDescription('Ingresá un teléfono válido para continuar.');
    expect(send).not.toHaveBeenCalled();
  });

  it('does not expose a stale invalid field after its conversation context is replaced', async () => {
    const send = vi.fn();
    const view = render(<ChatInput isTyping={false} tenantSlug="qa-a" chatSessionId="qa-one" onSendMessage={send} validateBeforeSend={validateEmail} />);
    const user = userEvent.setup();
    await user.type(input(), 'incompleto'); await user.keyboard('{Enter}');
    expect(input()).toHaveAccessibleDescription(emailError);
    view.rerender(<ChatInput isTyping={false} tenantSlug="qa-b" chatSessionId="qa-two" onSendMessage={send} validateBeforeSend={validateEmail} />);
    expect(input()).not.toHaveAttribute('aria-invalid', 'true');
    expect(input()).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText(emailError)).not.toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not mark valid text invalid when a selected attachment is rejected before upload', async () => {
    const send = vi.fn();
    const view = render(<ChatInput isTyping={false} onSendMessage={send} validateBeforeSend={validateEmail}
      mediaCapabilities={{ input_modes: {
        image: { enabled: true, accept: ['image/png'], max_file_mb: 10 },
        file: { enabled: true, accept: ['application/pdf'], max_file_mb: 1 },
      } }} />);
    const user = userEvent.setup();
    await user.type(input(), 'persona@example.invalid');
    await user.click(screen.getByRole('button', { name: 'Adjuntar archivo', exact: true }));
    // The chooser permits the larger image limit; the real file policy rejects this PDF.
    const oversized = new File([new Uint8Array(2 * 1024 * 1024)], 'evidencia.pdf', { type: 'application/pdf' });
    await user.upload(view.container.querySelector('input[type="file"]') as HTMLInputElement, oversized);
    expect(input()).toHaveValue('persona@example.invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('El archivo supera el limite permitido de 1 MB.');
    expect(input()).toHaveAccessibleDescription('El archivo supera el limite permitido de 1 MB.');
    expect(input()).not.toHaveAttribute('aria-invalid', 'true');
    expect(uploadChatAttachment).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not announce an error for an untouched or unavailable composer and does not send on Enter', async () => {
    const send = vi.fn();
    const view = render(<ChatInput isTyping={false} onSendMessage={send} validateBeforeSend={validateEmail} />);
    expect(input()).not.toHaveAttribute('aria-invalid', 'true');
    expect(input()).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText(emailError)).not.toBeInTheDocument();
    view.rerender(<ChatInput disabled disabledReason="Canal no disponible" isTyping={false} onSendMessage={send} validateBeforeSend={validateEmail} />);
    expect(input()).toBeDisabled();
    for (const name of ['Adjuntar archivo', 'Ubicacion', 'Audio', 'Mostrar emojis', 'Enviar mensaje']) {
      expect(screen.getByRole('button', { name, exact: true })).toBeDisabled();
    }
    await userEvent.setup().keyboard('{Enter}');
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByText(emailError)).not.toBeInTheDocument();
  });
});
