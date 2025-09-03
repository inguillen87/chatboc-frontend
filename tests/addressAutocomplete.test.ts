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
});
