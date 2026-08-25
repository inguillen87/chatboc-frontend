import type { ChatMediaInputModeConfig } from '@/types/chat';

export type ChatAttachmentMode = 'image' | 'file' | 'audio';

const DEFAULT_MAX_FILE_MB = 10;

const DEFAULT_ACCEPTED_BY_MODE: Record<ChatAttachmentMode, string[]> = {
  image: ['image/*'],
  file: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'video/*',
  ],
  audio: ['audio/*'],
};

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);

const normalizeAcceptedValue = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.startsWith('.')) return trimmed.replace(/\s+/g, '');
  if (/^[a-z0-9]+$/.test(trimmed)) return `.${trimmed}`;
  return trimmed;
};

const readAccepted = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map(normalizeAcceptedValue)
        .filter((item): item is string => Boolean(item)),
    ),
  );
};

export const getChatAttachmentAcceptedTypes = (
  modeConfig: ChatMediaInputModeConfig | undefined,
  mode: ChatAttachmentMode,
  fallbackAcceptedTypes?: string[],
) => {
  const canonical = readAccepted(modeConfig?.accept);
  if (Array.isArray(modeConfig?.accept)) return canonical;
  const configured = [
    ...readAccepted(modeConfig?.accepted_mime_types),
    ...readAccepted(modeConfig?.accepted_extensions),
  ];
  if (configured.length) return configured;
  return fallbackAcceptedTypes?.length ? fallbackAcceptedTypes : DEFAULT_ACCEPTED_BY_MODE[mode];
};

export const getChatAttachmentMaxFileMb = (
  modeConfig?: ChatMediaInputModeConfig,
  fallbackMb = DEFAULT_MAX_FILE_MB,
) => {
  const configured = Number(modeConfig?.max_file_mb);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return fallbackMb;
};

const extensionOf = (file: File) => {
  const name = file.name || '';
  const index = name.lastIndexOf('.');
  if (index < 0) return '';
  return name.slice(index).toLowerCase();
};

export const isChatImageFile = (file: File) => {
  const mime = (file.type || '').toLowerCase();
  return mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extensionOf(file));
};

const acceptedMatches = (file: File, accepted: string) => {
  const mime = (file.type || '').toLowerCase();
  const extension = extensionOf(file);

  if (accepted === '*/*') return true;
  if (accepted.startsWith('.')) return extension === accepted;
  if (accepted === 'image/*' && IMAGE_EXTENSIONS.has(extension)) return true;
  if (accepted.endsWith('/*')) {
    const prefix = accepted.slice(0, -1);
    return Boolean(mime && mime.startsWith(prefix));
  }
  return Boolean(mime && mime === accepted);
};

export const validateChatAttachment = (
  file: File,
  modeConfig: ChatMediaInputModeConfig | undefined,
  mode: ChatAttachmentMode,
  fallbackAcceptedTypes?: string[],
) => {
  const acceptedTypes = getChatAttachmentAcceptedTypes(modeConfig, mode, fallbackAcceptedTypes);
  const hasCanonicalAllowlist = Array.isArray(modeConfig?.accept);
  const maxFileMb = getChatAttachmentMaxFileMb(modeConfig);
  const maxBytes = maxFileMb * 1024 * 1024;

  if (file.size > maxBytes) {
    return `El archivo supera el limite permitido de ${maxFileMb} MB.`;
  }

  if (
    (hasCanonicalAllowlist && acceptedTypes.length === 0) ||
    (acceptedTypes.length && !acceptedTypes.some((accepted) => acceptedMatches(file, accepted)))
  ) {
    return 'Formato no permitido para este canal. Proba con una imagen, PDF, documento o archivo habilitado por el administrador.';
  }

  return null;
};
