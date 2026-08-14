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

  it('recovers legacy duplicated chat links as public claim tracking', async () => {
    const redirectRoute = routes.find((route) => route.path === '/chat/chat/:ticketId');

    expect(redirectRoute).toBeDefined();

    render(
      <MemoryRouter initialEntries={['/chat/chat/897013?source=whatsapp#pin=115474']}>
        <Routes>
          <Route path="/chat/chat/:ticketId" element={redirectRoute!.element} />
          <Route path="/tracking/claim/:code" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('/tracking/claim/897013?source=whatsapp#pin=115474'),
    ).toBeInTheDocument();
  });
});
