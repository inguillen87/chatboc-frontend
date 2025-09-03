/* @vitest-environment jsdom */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AutocompleteInput from '../src/components/autocomplete/AutocompleteInput';

describe('AutocompleteInput', () => {
  it('calls onSelect when a manual address is entered and input blurs', () => {
    const handleSelect = vi.fn();
    const { getByRole } = render(<AutocompleteInput onSelect={handleSelect} />);
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
      <AutocompleteInput onSelect={vi.fn()} />
    );
    const input = getByRole('textbox');
    fireEvent.change(input, { target: { value: 'San' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('country=ar');

    vi.unstubAllEnvs();
    global.fetch = originalFetch;
  });

  it('falls back to OpenStreetMap when MapTiler returns no results', async () => {
    vi.stubEnv('VITE_MAPTILER_KEY', 'demo');
    const fetchMock = vi
      .fn()
      // First call: MapTiler with no features
      .mockResolvedValueOnce({ json: () => Promise.resolve({ features: [] }) })
      // Second call: OSM
      .mockResolvedValueOnce({ json: () => Promise.resolve([{ display_name: 'Mendoza, Argentina' }]) });
    const originalFetch = global.fetch;
    // @ts-expect-error override global
    global.fetch = fetchMock;

    const { getByRole } = render(
      <AutocompleteInput onSelect={vi.fn()} />
    );
    const input = getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Mendoza' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toContain('nominatim.openstreetmap.org');

    vi.unstubAllEnvs();
    global.fetch = originalFetch;
  });
});
