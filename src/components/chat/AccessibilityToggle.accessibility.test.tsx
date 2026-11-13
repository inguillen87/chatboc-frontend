import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AccessibilityToggle, { readAccessibilityPrefs } from './AccessibilityToggle';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = '';
});

describe('AccessibilityToggle named keyboard panel', () => {
  it('gives the real popover a visible programmatic title', async () => {
    const user = userEvent.setup();
    render(<AccessibilityToggle />);
    await user.click(screen.getByRole('button', { name: 'Abrir ajustes de accesibilidad' }));
    const dialog = await screen.findByRole('dialog', { name: 'Accesibilidad', exact: true });
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)).toBeVisible();
    expect(document.getElementById(labelId!)).toHaveTextContent(/^Accesibilidad$/);
    expect(within(dialog).getAllByRole('button')).toHaveLength(6);
  });

  it('keeps every preference reachable by keyboard and returns focus after Escape', async () => {
    const user = userEvent.setup();
    render(<AccessibilityToggle />);
    const trigger = screen.getByRole('button', { name: 'Abrir ajustes de accesibilidad' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Accesibilidad', exact: true });
    const choices = within(dialog).getAllByRole('button');
    expect(choices[0]).toHaveFocus();
    for (let index = 1; index < choices.length; index += 1) {
      await user.tab();
      expect(choices[index]).toHaveFocus();
    }
    expect(choices[5]).toHaveAccessibleName(/^Menos movimiento/);
    expect(choices[5]).toHaveAttribute('aria-pressed', 'false');
    await user.keyboard(' ');
    expect(choices[5]).toHaveAttribute('aria-pressed', 'true');
    expect(readAccessibilityPrefs().reducedMotion).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps the title reference unique for two mounted preference editors', async () => {
    const user = userEvent.setup();
    render(<><AccessibilityToggle /><AccessibilityToggle /></>);
    const triggers = screen.getAllByRole('button', { name: 'Abrir ajustes de accesibilidad' });
    await user.click(triggers[0]);
    const firstTitle = (await screen.findByRole('dialog', { name: 'Accesibilidad', exact: true })).getAttribute('aria-labelledby');
    await user.keyboard('{Escape}');
    await user.click(triggers[1]);
    const secondTitle = (await screen.findByRole('dialog', { name: 'Accesibilidad', exact: true })).getAttribute('aria-labelledby');
    expect(firstTitle).toBeTruthy();
    expect(secondTitle).toBeTruthy();
    expect(secondTitle).not.toBe(firstTitle);
    expect(document.getElementById(secondTitle!)).toHaveTextContent(/^Accesibilidad$/);
  });
});
