/* @vitest-environment jsdom */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
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

  it('appends country filter from env when fetching suggestions', async () => {
    vi.stubEnv('VITE_MAPTILER_KEY', 'demo');
    vi.stubEnv('VITE_GEOCODER_COUNTRIES', 'ar');
    const fetchMock = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ features: [] }) })
    );
    const originalFetch = global.fetch;
    // @ts-expect-error override global
    global.fetch = fetchMock;

    const { getByRole } = render(
      <AddressAutocomplete onSelect={vi.fn()} />
    );
    const input = getByRole('textbox');
    fireEvent.change(input, { target: { value: 'San' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('country=ar');

    vi.unstubAllEnvs();
    global.fetch = originalFetch;
  });
});
