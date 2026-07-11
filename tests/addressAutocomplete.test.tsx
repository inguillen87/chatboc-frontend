/* @vitest-environment jsdom */
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AddressAutocomplete from '../src/components/ui/AddressAutocomplete';

describe('AddressAutocomplete', () => {
  it('calls onSelect when a manual address is entered and input blurs', () => {
    const handleSelect = vi.fn();
    const { getByRole } = render(<AddressAutocomplete onSelect={handleSelect} />);
    const input = getByRole('textbox');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Calle Falsa 123' } });
    fireEvent.blur(input);

    expect(handleSelect).toHaveBeenCalledWith('Calle Falsa 123');
  });

  it('cancels the delayed close when the component unmounts', () => {
    vi.useFakeTimers();
    const { getByRole, unmount } = render(
      <AddressAutocomplete onSelect={vi.fn()} />,
    );

    fireEvent.focus(getByRole('textbox'));
    fireEvent.blur(getByRole('textbox'));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
