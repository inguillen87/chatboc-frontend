export interface LocaleOption {
  label: string;
  locale: string;
  timezone: string;
}

const DEFAULT_LOCALE_OPTIONS: LocaleOption[] = [
  { label: 'Argentina', locale: 'es-AR', timezone: 'America/Argentina/Buenos_Aires' },
  { label: 'Chile', locale: 'es-CL', timezone: 'America/Santiago' },
  { label: 'Uruguay', locale: 'es-UY', timezone: 'America/Montevideo' },
  { label: 'México', locale: 'es-MX', timezone: 'America/Mexico_City' },
  { label: 'Colombia', locale: 'es-CO', timezone: 'America/Bogota' },
  { label: 'España', locale: 'es-ES', timezone: 'Europe/Madrid' },
  { label: 'Brasil', locale: 'pt-BR', timezone: 'America/Sao_Paulo' },
  { label: 'Estados Unidos', locale: 'en-US', timezone: 'America/New_York' },
];

const parseLocaleMarkets = (raw?: string): LocaleOption[] => {
  if (!raw || !raw.trim()) return [];

  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, locale, timezone] = entry.split('|').map((part) => part?.trim());
      if (!label || !locale || !timezone) return null;
      return { label, locale, timezone } as LocaleOption;
    })
    .filter((option): option is LocaleOption => Boolean(option));
};

const ENV_LOCALE_OPTIONS = parseLocaleMarkets(import.meta.env.VITE_LOCALE_MARKETS);

export const LOCALE_OPTIONS: LocaleOption[] = ENV_LOCALE_OPTIONS.length > 0 ? ENV_LOCALE_OPTIONS : DEFAULT_LOCALE_OPTIONS;
