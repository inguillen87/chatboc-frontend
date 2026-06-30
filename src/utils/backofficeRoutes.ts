export const TICKET_DESK_PATH = '/perfil?tab=tickets';

export const isTicketDeskLocation = (pathname: string, search = ''): boolean => {
  if (pathname !== '/perfil') return false;

  const normalizedSearch = search.startsWith('?') ? search : `?${search}`;
  const params = new URLSearchParams(normalizedSearch);
  return params.get('tab') === 'tickets';
};

export const isBackofficeRouteActive = (pathname: string, search: string, targetPath: string): boolean => {
  if (targetPath === TICKET_DESK_PATH) {
    return isTicketDeskLocation(pathname, search);
  }

  const [targetPathname] = targetPath.split('?');
  return pathname === targetPathname || pathname.startsWith(`${targetPathname}/`);
};
