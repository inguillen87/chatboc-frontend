import { useEffect, useRef } from 'react';

type MetaOptions = {
  title?: string;
  description?: string;
  image?: string;
  icon?: string;
  appleTouchIcon?: string;
};

const resolveAbsoluteUrl = (value?: string) => {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    return url.toString();
  } catch (error) {
    return value;
  }
};

export const usePageMetadata = ({ title, description, image, icon, appleTouchIcon }: MetaOptions) => {
  const previous = useRef<{
    title?: string;
    description?: string | null;
    ogImage?: string | null;
    twitterImage?: string | null;
    icons?: Array<{ element: HTMLLinkElement; href: string | null; type: string | null; sizes: string | null }>;
    appleTouchIcons?: Array<{ element: HTMLLinkElement; href: string | null }>;
    createdIcon?: HTMLLinkElement | null;
    createdAppleTouchIcon?: HTMLLinkElement | null;
  } | null>(null);

  useEffect(() => {
    previous.current = {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null,
      twitterImage: document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ?? null,
      icons: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')).map((element) => ({
        element,
        href: element.getAttribute('href'),
        type: element.getAttribute('type'),
        sizes: element.getAttribute('sizes'),
      })),
      appleTouchIcons: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')).map((element) => ({
        element,
        href: element.getAttribute('href'),
      })),
      createdIcon: null,
      createdAppleTouchIcon: null,
    };

    if (title) {
      document.title = title;
    }

    if (description) {
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', description);
      }

      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute('content', description);
      }
    }

    if (image) {
      const absoluteImage = resolveAbsoluteUrl(image);
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        ogImage.setAttribute('content', absoluteImage);
      }
      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (twitterImage) {
        twitterImage.setAttribute('content', absoluteImage);
      }
    }

    if (icon) {
      const absoluteIcon = resolveAbsoluteUrl(icon);
      const iconLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]'));
      if (iconLinks.length === 0) {
        const iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        document.head.appendChild(iconLink);
        iconLinks.push(iconLink);
        if (previous.current) previous.current.createdIcon = iconLink;
      }
      iconLinks.forEach((iconLink) => {
        iconLink.href = absoluteIcon;
        iconLink.type = 'image/webp';
        iconLink.setAttribute('sizes', '512x512');
      });
    }

    if (appleTouchIcon) {
      const absoluteAppleTouchIcon = resolveAbsoluteUrl(appleTouchIcon);
      const appleLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]'));
      if (appleLinks.length === 0) {
        const appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        appleLink.href = absoluteAppleTouchIcon;
        document.head.appendChild(appleLink);
        if (previous.current) previous.current.createdAppleTouchIcon = appleLink;
      } else {
        appleLinks.forEach((appleLink) => { appleLink.href = absoluteAppleTouchIcon; });
      }
    }

    return () => {
      if (!previous.current) return;
      const { title: oldTitle, description: oldDescription, ogImage, twitterImage, icons, appleTouchIcons, createdIcon, createdAppleTouchIcon } = previous.current;

      if (oldTitle !== undefined) {
        document.title = oldTitle;
      }

      if (oldDescription !== undefined) {
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
          metaDescription.setAttribute('content', oldDescription ?? '');
        }
        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) {
          ogDescription.setAttribute('content', oldDescription ?? '');
        }
      }

      if (ogImage !== undefined) {
        const ogImageMeta = document.querySelector('meta[property="og:image"]');
        if (ogImageMeta) {
          ogImageMeta.setAttribute('content', ogImage ?? '');
        }
      }

      if (twitterImage !== undefined) {
        const twitterImageMeta = document.querySelector('meta[name="twitter:image"]');
        if (twitterImageMeta) {
          twitterImageMeta.setAttribute('content', twitterImage ?? '');
        }
      }


      icons?.forEach(({ element, href, type, sizes }) => {
        if (href === null) element.removeAttribute('href'); else element.setAttribute('href', href);
        if (type === null) element.removeAttribute('type'); else element.setAttribute('type', type);
        if (sizes === null) element.removeAttribute('sizes'); else element.setAttribute('sizes', sizes);
      });
      appleTouchIcons?.forEach(({ element, href }) => {
        if (href === null) element.removeAttribute('href'); else element.setAttribute('href', href);
      });
      createdIcon?.remove();
      createdAppleTouchIcon?.remove();
    };
  }, [title, description, image, icon, appleTouchIcon]);
};

export default usePageMetadata;
