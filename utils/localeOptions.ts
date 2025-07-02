export interface LocaleOption {
  label: string;
  locale: string;
  timezone: string;
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { label: 'Argentina', locale: 'es-AR', timezone: 'America/Argentina/Buenos_Aires' },
  { label: 'Chile', locale: 'es-CL', timezone: 'America/Santiago' },
  { label: 'Uruguay', locale: 'es-UY', timezone: 'America/Montevideo' },
  { label: 'México', locale: 'es-MX', timezone: 'America/Mexico_City' },
  { label: 'Colombia', locale: 'es-CO', timezone: 'America/Bogota' },
  { label: 'España', locale: 'es-ES', timezone: 'Europe/Madrid' },
];
