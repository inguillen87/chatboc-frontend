interface FranchisePartnerConfig {
  partnerName?: string;
  salesUrl?: string;
}

const fromEnv = (key: string) => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === 'string' ? value.trim() : '';
};

export const getFranchisePartnerConfig = (): FranchisePartnerConfig => {
  const partnerName = fromEnv('VITE_FRANCHISE_PARTNER_NAME');
  const salesUrl = fromEnv('VITE_FRANCHISE_SALES_URL');

  return {
    partnerName: partnerName || undefined,
    salesUrl: salesUrl || undefined,
  };
};
