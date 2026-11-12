interface FranchisePartnerConfig {
  partnerName?: string;
  salesUrl?: string;
}

const readText = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : '';
};

export const getFranchisePartnerConfig = (): FranchisePartnerConfig => {
  const partnerName = readText(import.meta.env.VITE_FRANCHISE_PARTNER_NAME);
  const salesUrl = readText(import.meta.env.VITE_FRANCHISE_SALES_URL);

  return {
    partnerName: partnerName || undefined,
    salesUrl: salesUrl || undefined,
  };
};
