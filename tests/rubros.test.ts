import { describe, expect, it } from 'vitest';
import { extractRubroKey, extractRubroLabel, normalizeRubroKey } from '@/utils/rubros';

describe('rubros utils', () => {
  it('normalizes rubro keys removing accents but keeping separators', () => {
    expect(normalizeRubroKey('  Almacén  ')).toBe('almacen');
    expect(normalizeRubroKey('Retail_Minimarket')).toBe('retail_minimarket');
    expect(normalizeRubroKey('Comidas-Rápidas')).toBe('comidas-rapidas');
  });

  it('extracts rubro keys from strings and objects', () => {
    expect(extractRubroKey('  Almacén  ')).toBe('almacen');
    expect(extractRubroKey({ nombre: 'Bodega' })).toBe('bodega');
    expect(extractRubroKey({ clave: 'servicios_profesionales' })).toBe('servicios_profesionales');
    expect(extractRubroKey('{"nombre":"Panadería"}')).toBe('panaderia');
  });

  it('falls back to null when no key can be derived', () => {
    expect(extractRubroKey('   ')).toBeNull();
    expect(extractRubroKey({})).toBeNull();
    expect(extractRubroKey(null)).toBeNull();
  });

  it('extracts readable labels when available', () => {
    expect(extractRubroLabel(' Almacén ')).toBe('Almacén');
    expect(extractRubroLabel({ nombre: 'Bodega' })).toBe('Bodega');
    expect(extractRubroLabel({ clave: 'servicios_profesionales' })).toBe('servicios_profesionales');
    expect(extractRubroLabel('{"nombre":"Panadería"}')).toBe('Panadería');
  });
});
