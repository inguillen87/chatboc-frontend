export const openExternalLink = (rawUrl?: string | null) => {
  if (!rawUrl || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return;
  }

  try {
    const anchor = document.createElement('a');
    anchor.href = trimmedUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.referrerPolicy = 'no-referrer';
    anchor.style.position = 'absolute';
    anchor.style.left = '-9999px';
    anchor.style.top = '-9999px';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } catch (error) {
    try {
      const newWindow = window.open(trimmedUrl, '_blank', 'noopener,noreferrer');
      if (!newWindow) {
        window.location.assign(trimmedUrl);
      }
    } catch {
      window.location.assign(trimmedUrl);
    }
  }
};

export default openExternalLink;
