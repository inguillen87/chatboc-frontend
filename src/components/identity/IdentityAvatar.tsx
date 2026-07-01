import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { shouldRenderProfileImage } from '@/utils/avatarConsent';

const AVATAR_TONES = [
  'bg-sky-500/15 text-sky-700 ring-sky-500/20 dark:text-sky-200',
  'bg-emerald-500/15 text-emerald-700 ring-emerald-500/20 dark:text-emerald-200',
  'bg-amber-500/15 text-amber-800 ring-amber-500/20 dark:text-amber-200',
  'bg-rose-500/15 text-rose-700 ring-rose-500/20 dark:text-rose-200',
  'bg-cyan-500/15 text-cyan-700 ring-cyan-500/20 dark:text-cyan-200',
  'bg-violet-500/15 text-violet-700 ring-violet-500/20 dark:text-violet-200',
  'bg-lime-500/15 text-lime-800 ring-lime-500/20 dark:text-lime-200',
  'bg-slate-500/15 text-slate-700 ring-slate-500/20 dark:text-slate-200',
];

const SIZE_CLASSES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-10 w-10 text-sm',
} as const;

export type IdentityAvatarSize = keyof typeof SIZE_CLASSES;

export interface IdentityAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  source?: string | null;
  consented?: boolean | string | number | null;
  size?: IdentityAvatarSize;
  className?: string;
  fallbackClassName?: string;
  imageClassName?: string;
}

export function getIdentityInitials(name?: string | null): string {
  const cleaned = String(name || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '??';

  const words = cleaned.split(' ').filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase();
}

export function getIdentityAvatarTone(seed?: string | null): string {
  const normalized = String(seed || 'contacto').trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export const IdentityAvatar: React.FC<IdentityAvatarProps> = ({
  name,
  avatarUrl,
  source,
  consented,
  size = 'md',
  className,
  fallbackClassName,
  imageClassName,
}) => {
  const displayName = String(name || '').trim() || 'Contacto';
  const candidateImageUrl = String(avatarUrl || '').trim();
  const imageUrl = shouldRenderProfileImage({
    avatarUrl: candidateImageUrl,
    source,
    consented,
  })
    ? candidateImageUrl
    : '';
  const tone = getIdentityAvatarTone(displayName);
  const sourceLabel = source ? `Avatar ${source}` : imageUrl ? 'Avatar con imagen de perfil' : 'Avatar por iniciales';

  return (
    <Avatar
      className={cn(
        'shrink-0 ring-1 ring-border/70',
        SIZE_CLASSES[size],
        className,
      )}
      title={`${displayName} - ${sourceLabel}`}
    >
      {imageUrl ? (
        <AvatarImage
          src={imageUrl}
          alt={displayName}
          className={cn('object-cover', imageClassName)}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          'font-semibold tracking-normal',
          tone,
          fallbackClassName,
        )}
      >
        {getIdentityInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );
};

export default IdentityAvatar;
