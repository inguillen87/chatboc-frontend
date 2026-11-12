// Local visual fixture. No real organizations, authentication or external requests.
export async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(path, {method: 'GET'});
  const value: unknown = await response.json();
  if (!response.ok) throw Object.assign(new Error('Fixture response unavailable'), {status: response.status});
  return value as T;
}
