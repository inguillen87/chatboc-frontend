import React from 'react';
// Synthetic transport and tenant/socket providers. No production credentials or records.
const get = async (name: string) => {
  const response = await fetch(`/api/operations-fixture/${name}`);
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error('Synthetic source failure'), { status: response.status });
  return data;
};
export const getOperationsDashboardV2 = () => get('dashboard');
export const getOperationsHeatmapV2 = () => get('heatmap');
export const getOperationsActionCenterV2 = () => get('actions');
export const getOperationsAIBriefV2 = () => get('brief');
export const getOperationsAIOpsQueueV2 = () => get('queue');
export const getOperationsAIProviderStatusV2 = () => get('providers');
export const getOperationsFreshnessV2 = () => get('freshness');
export const getPublicMapConfigV1 = () => get('mapConfig');
export const useTenant = () => ({ currentSlug: 'qa-operations' });
const listeners = new Map<string, Set<(payload?: unknown) => void>>();
const socket = {
  on(name: string, listener: (payload?: unknown) => void) { const set = listeners.get(name) || new Set(); set.add(listener); listeners.set(name, set); },
  off(name: string, listener: (payload?: unknown) => void) { listeners.get(name)?.delete(listener); },
};
window.addEventListener('qa-operations-event', (event) => { const value = (event as CustomEvent).detail; listeners.get(value.name)?.forEach((listener) => listener(value.payload)); });
export const useSocket = () => ({ socket, isConnected: true });
export const PremiumTerritoryHeatmap = ({ points }: { points: unknown[] }) => <div data-testid="qa-map" style={{ minHeight: 80 }}>Mapa sustituido para esta prueba: {points.length} puntos. No se utiliza cartografía externa.</div>;
