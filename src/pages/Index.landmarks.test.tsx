import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useLandingExperience', () => ({
  useLandingExperience: () => ({ experience: null }),
}));

vi.mock('@/components/sections/HeroSection', () => ({ default: () => <section id="inicio" data-testid="landing-section" /> }));
vi.mock('@/components/sections/SaaSOperatingSystemSection', () => ({ default: () => <div data-testid="landing-section" /> }));
vi.mock('@/components/sections/SolutionSection', () => ({ default: () => <div data-testid="landing-section" /> }));
vi.mock('@/components/sections/PricingSection', () => ({ default: () => <div data-testid="landing-section" /> }));
vi.mock('@/components/sections/DemoShowcaseSection', () => ({ default: () => <div data-testid="landing-section" /> }));
vi.mock('@/components/sections/CtaSection', () => ({ default: () => <div data-testid="landing-section" /> }));

import Index from './Index';

describe('Index landmarks', () => {
  it('does not nest another main landmark inside the application layout', () => {
    const { container } = render(<Index />);

    expect(container.querySelector('main')).toBeNull();
    expect(container.querySelectorAll('[data-testid="landing-section"]')).toHaveLength(6);
    expect(container.querySelectorAll('#inicio')).toHaveLength(1);
    expect(container.querySelector('#inicio')?.parentElement?.tagName).not.toBe('SECTION');
    expect(
      ['diferencia-chatboc', 'problemas', 'como-funciona', 'publico-objetivo', 'senales-valor', 'modulos'].every(
        (id) => container.querySelector(`#${id}`),
      ),
    ).toBe(true);
  });
});
