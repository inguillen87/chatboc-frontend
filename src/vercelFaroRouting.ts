export const FARO_TDF_HOST = 'faro-tdf.vercel.app';
export const FARO_TDF_ENTRY_PATH = '/demo/institucional/tdf-discapacidad/index.html';

export const resolveFaroTdfDestination = (requestUrl: string): URL | null => {
  const url = new URL(requestUrl);

  if (url.hostname.toLowerCase() !== FARO_TDF_HOST || url.pathname !== '/') {
    return null;
  }

  url.pathname = FARO_TDF_ENTRY_PATH;
  return url;
};
