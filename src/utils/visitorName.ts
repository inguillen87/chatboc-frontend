import { safeLocalStorage } from './safeLocalStorage';

const VISITOR_NAME_KEY = 'visitor_name';

export function getVisitorName(): string {
  return safeLocalStorage.getItem(VISITOR_NAME_KEY) || '';
}

export function setVisitorName(name: string): void {
  safeLocalStorage.setItem(VISITOR_NAME_KEY, name);
}
