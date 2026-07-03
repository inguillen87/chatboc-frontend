import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ClerkTenantOnboardingDialog from './ClerkTenantOnboardingDialog';

const renderDialog = (props: Partial<React.ComponentProps<typeof ClerkTenantOnboardingDialog>> = {}) => {
  const onOpenChange = props.onOpenChange || vi.fn();
  const onSubmit = props.onSubmit || vi.fn();

  render(
    <ClerkTenantOnboardingDialog
      open
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      {...props}
    />,
  );

  return { onOpenChange, onSubmit };
};

describe('ClerkTenantOnboardingDialog', () => {
  it('keeps mandatory tenant onboarding from being dismissed', () => {
    renderDialog({ required: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear tenant/i })).toBeInTheDocument();
  });

  it('keeps the normal close affordance when onboarding is optional', () => {
    const { onOpenChange } = renderDialog({ required: false });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
