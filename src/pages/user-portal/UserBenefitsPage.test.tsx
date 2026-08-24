import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserBenefitsPage from './UserBenefitsPage';

const benefitsMocks = vi.hoisted(() => ({
  user: null as null | { id: string; name?: string; email?: string },
  authority: {
    clerkStatus: 'signed_out' as 'disabled' | 'loading' | 'signed_out' | 'syncing' | 'ready',
    hasBearerSession: false,
    hasVerifiedSession: false,
  },
  content: {} as any,
  getLoyalty: vi.fn(),
  redeemBenefit: vi.fn(),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: benefitsMocks.user }),
}));

vi.mock('@/components/access/SessionAuthorityContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/access/SessionAuthorityContext')>()),
  useSessionAuthority: () => benefitsMocks.authority,
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/hooks/usePortalContent', () => ({
  usePortalContent: () => ({ content: benefitsMocks.content }),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    getLoyalty: benefitsMocks.getLoyalty,
    redeemBenefit: benefitsMocks.redeemBenefit,
  },
}));

const staleSummary = {
  points: 987654,
  level: 'privado-stale',
  surveysCompleted: 12,
  suggestionsShared: 8,
  claimsFiled: 4,
  hasParticipationMetrics: true,
  transactions: [
    {
      id: 'tx-stale',
      description: 'Movimiento privado de Persona Stale',
      points: 100,
      type: 'earned',
      date: '2026-08-20T12:00:00Z',
    },
  ],
  availableRewards: [
    { id: 'reward-stale', title: 'Premio privado stale', cost: 50, type: 'private' },
  ],
};

const verifiedSummary = {
  points: 100,
  level: 'verified',
  surveysCompleted: 1,
  suggestionsShared: 1,
  claimsFiled: 1,
  transactions: [],
  availableRewards: [
    { id: 'reward-verified', title: 'Premio verified', cost: 10, type: 'beneficio' },
  ],
};

describe('UserBenefitsPage verified-session boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    benefitsMocks.user = null;
    benefitsMocks.authority = {
      clerkStatus: 'signed_out',
      hasBearerSession: false,
      hasVerifiedSession: false,
    };
    benefitsMocks.content = {
      loyaltySummary: staleSummary,
      catalog: [
        {
          id: 'public-reward',
          title: 'Beneficio público',
          price: 10,
          priceLabel: '10 puntos',
          category: 'beneficio',
          status: 'available',
        },
      ],
    };
    benefitsMocks.getLoyalty.mockResolvedValue(verifiedSummary);
    benefitsMocks.redeemBenefit.mockResolvedValue({ ok: true });
  });

  it.each(['loading', 'signed_out'] as const)(
    'hides stale loyalty PII and performs no loyalty or redeem calls while Clerk is %s',
    (clerkStatus) => {
      benefitsMocks.user = {
        id: 'stale-user',
        name: 'Persona Stale Privada',
        email: 'stale-benefits@example.test',
      };
      benefitsMocks.authority = {
        clerkStatus,
        hasBearerSession: clerkStatus === 'loading',
        hasVerifiedSession: false,
      };

      render(
        <MemoryRouter>
          <UserBenefitsPage />
        </MemoryRouter>,
      );

      expect(screen.queryByText(/987[.,]?654 pts/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Movimiento privado de Persona Stale')).not.toBeInTheDocument();
      expect(screen.queryByText('Premio privado stale')).not.toBeInTheDocument();
      const redeemButton = screen.getByRole('button', { name: 'Canjear' });
      expect(redeemButton).toBeDisabled();
      fireEvent.click(redeemButton);
      expect(benefitsMocks.getLoyalty).not.toHaveBeenCalled();
      expect(benefitsMocks.redeemBenefit).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      label: 'Clerk ready cookie-only',
      authority: { clerkStatus: 'ready' as const, hasBearerSession: false, hasVerifiedSession: true },
    },
    {
      label: 'verified legacy bearer',
      authority: { clerkStatus: 'disabled' as const, hasBearerSession: true, hasVerifiedSession: true },
    },
  ])('loads loyalty and permits redeem for $label authority', async ({ authority }) => {
    benefitsMocks.user = { id: 'verified-user', email: 'verified@example.test' };
    benefitsMocks.authority = authority;

    render(
      <MemoryRouter>
        <UserBenefitsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(benefitsMocks.getLoyalty).toHaveBeenCalledWith('junin'));
    expect(await screen.findByText('100 pts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Canjear' }));

    await waitFor(() => {
      expect(benefitsMocks.redeemBenefit).toHaveBeenCalledWith('junin', 'reward-verified');
    });
    expect(benefitsMocks.getLoyalty).toHaveBeenCalledTimes(2);
  });

  it('never exposes user A loyalty state while authority rotates to user B', async () => {
    const userBSummary = deferred<typeof verifiedSummary>();
    const userASummary = {
      ...verifiedSummary,
      points: 321,
      transactions: [
        {
          id: 'tx-user-a',
          description: 'Movimiento privado A',
          points: 25,
          type: 'earned',
          date: '2026-08-20T12:00:00Z',
        },
      ],
    };
    benefitsMocks.user = { id: 'user-a', email: 'a@example.test' };
    benefitsMocks.authority = {
      clerkStatus: 'ready',
      hasBearerSession: false,
      hasVerifiedSession: true,
    };
    benefitsMocks.getLoyalty
      .mockResolvedValueOnce(userASummary)
      .mockImplementationOnce(() => userBSummary.promise);

    const view = render(
      <MemoryRouter>
        <UserBenefitsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('321 pts')).toBeInTheDocument();
    expect(screen.getByText('Movimiento privado A')).toBeInTheDocument();

    benefitsMocks.authority = {
      clerkStatus: 'syncing',
      hasBearerSession: false,
      hasVerifiedSession: false,
    };
    view.rerender(
      <MemoryRouter>
        <UserBenefitsPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText('321 pts')).not.toBeInTheDocument();
    expect(screen.queryByText('Movimiento privado A')).not.toBeInTheDocument();

    benefitsMocks.user = { id: 'user-b', email: 'b@example.test' };
    benefitsMocks.authority = {
      clerkStatus: 'ready',
      hasBearerSession: false,
      hasVerifiedSession: true,
    };
    view.rerender(
      <MemoryRouter>
        <UserBenefitsPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText('321 pts')).not.toBeInTheDocument();
    expect(screen.queryByText('Movimiento privado A')).not.toBeInTheDocument();

    userBSummary.resolve(verifiedSummary);
    expect(await screen.findByText('100 pts')).toBeInTheDocument();
  });

  it('does not refresh or mutate loyalty after authority is revoked during redeem', async () => {
    const redemption = deferred<{ ok: boolean }>();
    benefitsMocks.user = { id: 'user-a', email: 'a@example.test' };
    benefitsMocks.authority = {
      clerkStatus: 'ready',
      hasBearerSession: false,
      hasVerifiedSession: true,
    };
    benefitsMocks.redeemBenefit.mockImplementationOnce(() => redemption.promise);

    const view = render(
      <MemoryRouter>
        <UserBenefitsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('100 pts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Canjear' }));
    await waitFor(() => {
      expect(benefitsMocks.redeemBenefit).toHaveBeenCalledWith('junin', 'reward-verified');
    });

    benefitsMocks.authority = {
      clerkStatus: 'signed_out',
      hasBearerSession: false,
      hasVerifiedSession: false,
    };
    view.rerender(
      <MemoryRouter>
        <UserBenefitsPage />
      </MemoryRouter>,
    );

    redemption.resolve({ ok: true });
    await redemption.promise;
    await waitFor(() => expect(screen.queryByText('100 pts')).not.toBeInTheDocument());
    expect(benefitsMocks.getLoyalty).toHaveBeenCalledTimes(1);
  });
});
