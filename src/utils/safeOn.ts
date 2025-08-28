export function safeOn(
  target: any,
  event: string,
  handler: (...args: any[]) => void
): boolean {
  if (!target) return false;
  if (typeof (target as any).on === 'function') {
    (target as any).on(event, handler);
    return true;
  }
  if (typeof (target as any).addEventListener === 'function') {
    (target as any).addEventListener(event, handler as EventListener);
    return true;
  }
  return false;
}

export function assertEventSource(target: any, label = 'target') {
  const hasOn = !!target && typeof (target as any).on === 'function';
  const hasAdd = !!target && typeof (target as any).addEventListener === 'function';
  // eslint-disable-next-line no-console
  console.log(`[DEBUG] ${label}`, {
    type: target?.constructor?.name,
    hasOn,
    hasAdd,
    keys: target ? Object.keys(target) : null,
    value: target,
  });
  if (!hasOn && !hasAdd) {
    // eslint-disable-next-line no-console
    console.error(`[FATAL] ${label} no soporta .on()/.addEventListener()`);
  }
}
