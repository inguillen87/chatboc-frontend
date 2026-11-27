import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readAccessibilityPrefs } from '@/components/chat/AccessibilityToggle';
import { readInstitutionalLargeText } from '@/components/knowledge/InstitutionalTextBlocks';

import {
  TenantAccessibilityBar,
  TenantAccessibilityProvider,
} from './TenantAccessibilityBar';

const renderAccessibilityBar = () => render(
  <TenantAccessibilityProvider>
    <TenantAccessibilityBar />
  </TenantAccessibilityProvider>,
);

const resetPreferences = () => {
  window.localStorage.removeItem('chatboc.institutional-large-text');
  window.localStorage.removeItem('chatboc_accessibility');
  document.documentElement.classList.remove('a11y-high-contrast');
};

describe('TenantAccessibilityBar', () => {
  beforeEach(resetPreferences);
  afterEach(() => {
    cleanup();
    resetPreferences();
  });

  it('persists enlarged text and high contrast when the bar is mounted again', () => {
    const first = renderAccessibilityBar();
    const largeText = screen.getByRole('button', { name: 'Texto ampliado' });
    const highContrast = screen.getByRole('button', { name: 'Alto contraste' });

    expect(largeText).toHaveAttribute('aria-pressed', 'false');
    expect(highContrast).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(largeText);
    fireEvent.click(highContrast);

    expect(readInstitutionalLargeText()).toBe(true);
    expect(readAccessibilityPrefs().highContrast).toBe(true);
    expect(document.documentElement).toHaveClass('a11y-high-contrast');
    expect(largeText).toHaveAttribute('aria-pressed', 'true');
    expect(highContrast).toHaveAttribute('aria-pressed', 'true');

    first.unmount();
    renderAccessibilityBar();

    expect(screen.getByRole('button', { name: 'Texto ampliado' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Alto contraste' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(readInstitutionalLargeText()).toBe(true);
    expect(readAccessibilityPrefs().highContrast).toBe(true);
    expect(document.documentElement).toHaveClass('a11y-high-contrast');
  });
});
