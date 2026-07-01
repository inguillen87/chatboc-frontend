import { apiFetch } from '@/utils/api';

export interface ProfileAvatarResponse {
  avatarUrl: string;
  avatarSource: string;
  avatarConsent: boolean;
  picture?: string;
  upload?: {
    originalName?: string;
    mimetype?: string;
    size?: number;
    thumbUrl?: string;
  };
}

const readString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const readBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'si', 's', 'accepted', 'consented'].includes(value.trim().toLowerCase());
  }
  return false;
};

export async function uploadProfileAvatar(
  file: File,
  options: { isWidgetRequest?: boolean } = {},
): Promise<ProfileAvatarResponse> {
  const formData = new FormData();
  formData.append('avatar', file, file.name);

  const payload = await apiFetch<Record<string, any>>('/auth/profile/avatar', {
    method: 'POST',
    body: formData,
    isWidgetRequest: options.isWidgetRequest,
    preserveAuthOn401: true,
  });

  return {
    avatarUrl: readString(payload.avatar_url, payload.avatarUrl, payload.picture),
    avatarSource: readString(payload.avatar_source, payload.avatarSource, 'profile_upload'),
    avatarConsent: readBoolean(payload.avatar_consent ?? payload.profile_picture_consent ?? true),
    picture: readString(payload.picture),
    upload: payload.upload
      ? {
          originalName: readString(payload.upload.original_name, payload.upload.originalName),
          mimetype: readString(payload.upload.mimetype),
          size: typeof payload.upload.size === 'number' ? payload.upload.size : undefined,
          thumbUrl: readString(payload.upload.thumb_url, payload.upload.thumbUrl),
        }
      : undefined,
  };
}
