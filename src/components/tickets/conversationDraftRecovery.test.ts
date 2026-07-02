import { describe, expect, it, vi } from 'vitest';

import { restoreComposerDraftAfterSendFailure, type ConversationAttachmentPreview } from './conversationDraftRecovery';

describe('restoreComposerDraftAfterSendFailure', () => {
  it('restores the operator text and attachment when a normal send fails', () => {
    const setMessage = vi.fn();
    const setAttachmentPreview = vi.fn();
    const attachment = {
      file: new File(['test'], 'foto.jpg', { type: 'image/jpeg' }),
      previewUrl: 'blob:test',
    } satisfies ConversationAttachmentPreview;

    restoreComposerDraftAfterSendFailure({
      draftMessage: 'Estamos revisando tu reclamo.',
      draftAttachmentPreview: attachment,
      setMessage,
      setAttachmentPreview,
    });

    expect(setMessage).toHaveBeenCalledWith('Estamos revisando tu reclamo.');
    expect(setAttachmentPreview).toHaveBeenCalledWith(attachment);
  });

  it('does not overwrite explicit quick-action payloads', () => {
    const setMessage = vi.fn();
    const setAttachmentPreview = vi.fn();

    restoreComposerDraftAfterSendFailure({
      payload: {
        text: 'payload text',
        attachmentInfo: { name: 'adjunto.pdf', url: 'https://cdn.test/adjunto.pdf' },
      },
      draftMessage: 'Borrador anterior',
      draftAttachmentPreview: {
        file: new File(['test'], 'foto.jpg', { type: 'image/jpeg' }),
        previewUrl: 'blob:test',
      },
      setMessage,
      setAttachmentPreview,
    });

    expect(setMessage).not.toHaveBeenCalled();
    expect(setAttachmentPreview).not.toHaveBeenCalled();
  });
});
