import { useEffect, useRef } from 'react';

type MetaOptions = {
  title?: string;
  description?: string;
  image?: string;
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

export const usePageMetadata = ({ title, description, image }: MetaOptions) => {
  const previous = useRef<{
    title?: string;
    description?: string | null;
    ogImage?: string | null;
    twitterImage?: string | null;
  } | null>(null);

  useEffect(() => {
    previous.current = {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null,
      twitterImage: document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ?? null,
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

    return () => {
      if (!previous.current) return;
      const { title: oldTitle, description: oldDescription, ogImage, twitterImage } = previous.current;

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
    };
  }, [title, description, image]);
};

export default usePageMetadata;
