import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserClaimsPage from './UserClaimsPage';

const claimsMocks = vi.hoisted(() => ({
  publicClaims: [] as any[],
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: null, isLoading: false }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin', widgetToken: null }),
}));

vi.mock('@/hooks/usePortalContent', () => ({
  usePortalContent: () => ({
    commerceSession: null,
    publicClaims: claimsMocks.publicClaims,
    isLoading: false,
  }),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    listTickets: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/api/widgetCommerce', () => ({
  getWidgetClaimDetail: vi.fn(),
}));

describe('UserClaimsPage public claim actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimsMocks.publicClaims = [
      {
        id: 'claim-42',
        nroTicket: 'M-378430',
        pin: '900144',
        title: 'Arreglo de calle',
        status: 'en_proceso',
        statusLabel: 'En proceso',
        channel: 'whatsapp',
        commentEndpoint: '/chat',
        photoEndpoint: '/api/public/tracking/claims/42/messages',
        attachments: [],
        timeline: [],
      },
    ];
  });

  it('keeps legacy comment and photo actions inside secure claim tracking', () => {
    render(
      <MemoryRouter initialEntries={['/t/junin/portal/reclamos']}>
        <UserClaimsPage />
      </MemoryRouter>,
    );

    const commentLink = screen.getByRole('link', { name: /agregar comentario/i });
    const photoLink = screen.getByRole('link', { name: /agregar foto/i });

    expect(commentLink).toHaveAttribute('href', '/tracking/claim/378430?pin=900144#mesa-ayuda');
    expect(photoLink).toHaveAttribute('href', '/tracking/claim/378430?pin=900144#mesa-ayuda');
    expect(commentLink).not.toHaveAttribute('href', '/chat');
    expect(commentLink).not.toHaveAttribute('target', '_blank');
    expect(photoLink).not.toHaveAttribute('target', '_blank');
  });
});
