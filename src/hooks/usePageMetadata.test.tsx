import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usePageMetadata } from './usePageMetadata';

function MetaProbe({ title, description }: { title: string; description: string }) {
  usePageMetadata({ title, description });
  return null;
}

const createMeta = (attr: 'name' | 'property', key: string, content: string) => {
  const el = document.createElement('meta');
  el.setAttribute(attr, key);
  el.setAttribute('content', content);
  document.head.appendChild(el);
  return el;
};

describe('usePageMetadata', () => {
  const elements: HTMLMetaElement[] = [];

  beforeEach(() => {
    document.title = 'Chatboc · Agentes IA con tu marca para gobiernos y empresas';
    elements.push(
      createMeta('name', 'description', 'Descripción inicial'),
      createMeta('property', 'og:title', 'OG Título inicial'),
      createMeta('property', 'og:description', 'OG Descripción inicial'),
      createMeta('name', 'twitter:title', 'Twitter Título inicial'),
      createMeta('name', 'twitter:description', 'Twitter Descripción inicial'),
    );
  });

  afterEach(() => {
    cleanup();
    elements.splice(0).forEach((el) => el.remove());
    document.title = '';
  });

  it('updates and restores document title, description, Open Graph and Twitter metadata', () => {
    const view = render(
      <MetaProbe
        title="Encuestas ciudadanas · Chatboc"
        description="Respondé y compartí las encuestas abiertas."
      />,
    );

    expect(document.title).toBe('Encuestas ciudadanas · Chatboc');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Respondé y compartí las encuestas abiertas.',
    );
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
      'Encuestas ciudadanas · Chatboc',
    );
    expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(
      'Respondé y compartí las encuestas abiertas.',
    );
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(
      'Encuestas ciudadanas · Chatboc',
    );
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toBe(
      'Respondé y compartí las encuestas abiertas.',
    );

    view.unmount();

    expect(document.title).toBe('Chatboc · Agentes IA con tu marca para gobiernos y empresas');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Descripción inicial',
    );
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(
      'OG Título inicial',
    );
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(
      'Twitter Título inicial',
    );
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toBe(
      'Twitter Descripción inicial',
    );
  });
});
