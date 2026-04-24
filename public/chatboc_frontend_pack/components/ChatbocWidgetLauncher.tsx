import * as React from 'react';

type ChatbocWidgetLauncherProps = {
  isOpen?: boolean;
  onClick?: () => void;
  className?: string;
  ariaLabelOpen?: string;
  ariaLabelClose?: string;
  reducedMotion?: boolean;
};

export function ChatbocWidgetLauncher({
  isOpen = false,
  onClick,
  className,
  ariaLabelOpen = 'Abrir chat',
  ariaLabelClose = 'Cerrar chat',
  reducedMotion = false,
}: ChatbocWidgetLauncherProps) {
  const launcherSrc = reducedMotion
    ? '/branding/chatboc/widget/chatboc-widget-launcher-static.svg'
    : '/branding/chatboc/widget/chatboc-widget-launcher-animated.svg';

  return (
    <button
      type="button"
      onClick={onClick}
      className={['chatboc-launcher', className].filter(Boolean).join(' ')}
      aria-label={isOpen ? ariaLabelClose : ariaLabelOpen}
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <span className="chatboc-launcher__close" aria-hidden="true">×</span>
      ) : (
        <img
          src={launcherSrc}
          alt=""
          width={64}
          height={64}
          className="chatboc-launcher__img"
          draggable={false}
        />
      )}
    </button>
  );
}
