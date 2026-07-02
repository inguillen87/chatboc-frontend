import type { SendPayload } from '@/types/chat';

export type ConversationAttachmentPreview = {
  file: File;
  previewUrl: string;
};

export const restoreComposerDraftAfterSendFailure = ({
  payload,
  draftMessage,
  draftAttachmentPreview,
  setMessage,
  setAttachmentPreview,
}: {
  payload?: Partial<SendPayload>;
  draftMessage: string;
  draftAttachmentPreview: ConversationAttachmentPreview | null;
  setMessage: (value: string) => void;
  setAttachmentPreview: (value: ConversationAttachmentPreview | null) => void;
}) => {
  if (!payload?.text && draftMessage) {
    setMessage(draftMessage);
  }
  if (!payload?.attachmentInfo && draftAttachmentPreview) {
    setAttachmentPreview(draftAttachmentPreview);
  }
};
