import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import routes from './routesConfig';

vi.unmock('react-router-dom');

const LocationProbe = () => {
  const location = useLocation();
  return <span>{`${location.pathname}${location.search}${location.hash}`}</span>;
};

describe('legacy route redirects', () => {
  it('preserves search and hash when redirecting Twilio ticket links', async () => {
    const redirectRoute = routes.find((route) => route.path === '/t/chat/:ticketId');

    expect(redirectRoute).toBeDefined();

    render(
      <MemoryRouter initialEntries={['/t/chat/M-378430?source=twilio#pin=900144']}>
        <Routes>
          <Route path="/t/chat/:ticketId" element={redirectRoute!.element} />
          <Route path="/tracking/claim/:code" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('/tracking/claim/M-378430?source=twilio#pin=900144'),
    ).toBeInTheDocument();
  });
});
