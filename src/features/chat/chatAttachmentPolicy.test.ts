import { describe, expect, it } from 'vitest';

import {
  getChatAttachmentAcceptedTypes,
  getChatAttachmentMaxFileMb,
  isChatImageFile,
  validateChatAttachment,
} from './chatAttachmentPolicy';

describe('chatAttachmentPolicy', () => {
  it('uses backend accepted MIME types and extensions when provided', () => {
    expect(
      getChatAttachmentAcceptedTypes(
        {
          accepted_mime_types: ['application/pdf', ' image/jpeg '],
          accepted_extensions: ['xlsx', '.docx'],
        },
        'file',
      ),
    ).toEqual(['application/pdf', 'image/jpeg', '.xlsx', '.docx']);
  });

  it('rejects unsupported executable uploads before preview or send', () => {
    const file = new File(['binary'], 'setup.exe', { type: 'application/x-msdownload' });

    expect(
      validateChatAttachment(
        file,
        {
          accepted_mime_types: ['application/pdf'],
          accepted_extensions: ['.jpg'],
        },
        'file',
      ),
    ).toMatch(/Formato no permitido/i);
  });

  it('rejects files over the configured tenant limit', () => {
    const file = new File([new Uint8Array(2 * 1024 * 1024)], 'boleta.pdf', { type: 'application/pdf' });

    expect(
      validateChatAttachment(
        file,
        {
          max_file_mb: 1,
          accepted_mime_types: ['application/pdf'],
        },
        'file',
      ),
    ).toBe('El archivo supera el limite permitido de 1 MB.');
  });

  it('accepts images by extension when the browser does not provide MIME type', () => {
    const file = new File(['image'], 'foto-reclamo.JPG', { type: '' });

    expect(isChatImageFile(file)).toBe(true);
    expect(validateChatAttachment(file, undefined, 'image')).toBeNull();
  });

  it('uses max_file_mb when present and keeps a safe default otherwise', () => {
    expect(getChatAttachmentMaxFileMb({ max_file_mb: 4 })).toBe(4);
    expect(getChatAttachmentMaxFileMb({ max_file_mb: null })).toBe(10);
  });
});
