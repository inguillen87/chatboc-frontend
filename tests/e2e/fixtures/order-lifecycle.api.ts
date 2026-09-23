// Browser fixture transport only. No credentials, customer data or production requests.
export class ApiError extends Error {
  constructor(message: string, public status: number, public body?: Record<string, unknown>) { super(message); }
}
async function request(path: string, body?: unknown) {
  const response = await fetch(path, body ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const value = await response.json();
  if (!response.ok) throw new ApiError('Synthetic request failed', response.status, value);
  return value;
}
export const fetchPublicOrder = (code: string) => request(`/api/fixture/public/${encodeURIComponent(code)}`);
export const apiClient = {
  adminGetOrder: (tenant: string, id: string) => request(`/api/fixture/${tenant}/orders/${encodeURIComponent(id)}`),
  adminUpdateOrder: (tenant: string, id: string, body: unknown) => request(`/api/fixture/${tenant}/orders/${encodeURIComponent(id)}`, body),
  getFulfillmentConfig: (tenant: string) => request(`/api/fixture/${tenant}/fulfillment`),
};
export const useTenant = () => ({ currentSlug: 'qa-order' });
