import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import QuickReplies from './QuickReplies';

describe('QuickReplies', () => {
  it('uses a native list while preserving each quick reply as a button', () => {
    const onSelect = vi.fn();
    const items = [
      { id: 'claims', label: 'Ver reclamos' },
      { id: 'surveys', label: 'Abrir encuestas' },
    ];

    render(<QuickReplies items={items} onSelect={onSelect} />);

    const list = screen.getByRole('list', { name: 'Sugerencias rápidas' });
    expect(list.tagName).toBe('UL');

    const listItems = within(list).getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    expect(listItems.every((item) => item.tagName === 'LI' && !item.hasAttribute('role'))).toBe(true);

    const claimsButton = within(list).getByRole('button', { name: 'Enviar sugerencia: Ver reclamos' });
    expect(claimsButton).not.toHaveAttribute('role');
    fireEvent.click(claimsButton);
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });
});
