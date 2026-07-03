import React from 'react';

import { CLERK_PUBLISHABLE_KEY } from '@/env';

export type ClerkRuntimeSource = 'env' | 'backend' | 'disabled';

export interface ClerkRuntimeValue {
  enabled: boolean;
  loading: boolean;
  publishableKey: string;
  source: ClerkRuntimeSource;
  socialProviders: string[];
}

export const DEFAULT_CLERK_RUNTIME: ClerkRuntimeValue = {
  enabled: Boolean(CLERK_PUBLISHABLE_KEY),
  loading: false,
  publishableKey: CLERK_PUBLISHABLE_KEY,
  source: CLERK_PUBLISHABLE_KEY ? 'env' : 'disabled',
  socialProviders: ['google', 'facebook', 'linkedin'],
};

const ClerkRuntimeContext = React.createContext<ClerkRuntimeValue>(DEFAULT_CLERK_RUNTIME);

export const ClerkRuntimeProvider = ClerkRuntimeContext.Provider;

export const useClerkRuntime = () => React.useContext(ClerkRuntimeContext);
