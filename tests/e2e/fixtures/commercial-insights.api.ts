// Test-only replacement of the shared auth transport, not the CRM service or components.
export async function apiFetch<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!path.startsWith('/api/admin/tenants/qa-sprint/leads')) throw new Error('Unexpected fixture API scope');
  const response = await fetch(path, { method: options.method || 'GET', headers: { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  if (!response.ok) throw Object.assign(new Error('Fixture API rejected request'), { status: response.status });
  return response.json() as Promise<T>;
}
