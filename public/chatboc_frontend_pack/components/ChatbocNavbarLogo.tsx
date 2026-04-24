import * as React from 'react';

type ChatbocNavbarLogoProps = {
  size?: number;
  variant?: 'circle' | 'clean';
  alt?: string;
  className?: string;
};

export function ChatbocNavbarLogo({
  size = 36,
  variant = 'circle',
  alt = 'Chatboc',
  className,
}: ChatbocNavbarLogoProps) {
  const src =
    variant === 'clean'
      ? '/branding/chatboc/navbar/chatboc-navbar-mark-clean.svg'
      : '/branding/chatboc/navbar/chatboc-navbar-mark-circle.svg';

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, display: 'block', objectFit: 'contain' }}
    />
  );
}
