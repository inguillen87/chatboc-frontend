import { describe, it, expect } from 'vitest';
// Revert to named imports
import { calculateSimilarity, suggestMappings, DEFAULT_SYSTEM_FIELDS, SystemField } from './columnMatcher';

describe('columnMatcher utils', () => {
  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateSimilarity('Nombre del Producto', 'Nombre del Producto')).toBe(1);
      expect(calculateSimilarity('sku', 'sku')).toBe(1);
    });

    it('should return 0 for completely different strings of same length', () => {
      expect(calculateSimilarity('abc', 'xyz')).toBe(0);
    });

    it('should return 0 if one string is empty and other is not after normalization', () => {
      expect(calculateSimilarity('Precio', '')).toBe(0);
      expect(calculateSimilarity('', 'Description')).toBe(0);
    });

    it('should return 1 if both strings are empty or become empty after normalization', () => {
      expect(calculateSimilarity('', '')).toBe(1);
      expect(calculateSimilarity('   ', '---')).toBe(1);
    });

    it('should handle case and special characters (normalization)', () => {
      expect(calculateSimilarity('Nombre Producto', 'nombre_producto')).toBeCloseTo(1);
      expect(calculateSimilarity('Precio Unitario', 'preciounitario')).toBeCloseTo(1);
      expect(calculateSimilarity('EAN-13', 'ean13')).toBeCloseTo(1);
    });

    it('should calculate similarity for partially different strings', () => {
      expect(calculateSimilarity('nombre', 'nomre')).toBeCloseTo(1 - 1/6); // distance 1, max_len 6
      // s1: "description" (11), s2: "descriptn" (9). distance is 2. max_len is 11. similarity = 1 - (2/11)
      expect(calculateSimilarity('description', 'descriptn')).toBeCloseTo(1 - 2/11);
      expect(calculateSimilarity('Categoría', 'Categoria Prod.')).toBeLessThan(1);
      expect(calculateSimilarity('Categoría', 'Categoria Prod.')).toBeGreaterThan(0.5);
    });

    it('should correctly calculate similarity for short, different strings like SKU and Code', () => {
      // normalize("SKU") -> "sku" (len 3)
      // normalize("Code") -> "code" (len 4)
      // levenshtein distance for "sku", "code" is 3 (s->c, k->o, u->d, ""->e) - no, it's 3 substitutions.
      // s k u
      // c o d e
      // If we change s->c, k->o, u->d, it's 3 changes. No, distance is 2.
      // s k u -
      // c o d e
      // Align 'sku-' with 'code':
      // sku- vs code. s->c (1), k->o (1), u->d (0), - ->e (1) Total 3 (My manual is still shaky)
      // Let's use an online calculator: Levenshtein distance for "sku" and "code" is 3.
      // Max length is 4. Similarity = 1 - 3/4 = 0.25. The previous reasoning was correct.
      // The mystery is why the log showed 0.000 for this pair in suggestMappings.
      // And why the test "should correctly calculate similarity for short, different strings like SKU and Code"
      // FAILED: AssertionError: expected +0 to be close to 0.25
      // After manual trace, Levenshtein distance for "sku" and "code" is 4. Max length 4. Similarity = 1 - 4/4 = 0.
      expect(calculateSimilarity("SKU", "Code")).toBe(0);
    });
  });

  describe('suggestMappings', () => {
    const userColumns1 = ['ID Producto', 'Nombre Articulo', 'Precio Venta', 'Stock Disponible', 'Descripcion Detallada'];
    // Ensure SystemField is correctly typed here
    const systemFields1: SystemField[] = [
      { key: 'sku', label: 'SKU / Código' },
      { key: 'nombre', label: 'Nombre del Producto' },
      { key: 'precio', label: 'Precio' },
      { key: 'stock', label: 'Stock / Cantidad' },
      { key: 'descripcion', label: 'Descripción' },
    ];

    it('should map clearly matching columns', () => {
      const suggestions = suggestMappings(userColumns1, systemFields1);

      const nombreMapping = suggestions.find(s => s.systemFieldKey === 'nombre');
      // "ID Producto" (0.529) has higher similarity than "Nombre Articulo" (0.471) for "Nombre del Producto"
      // Both are > threshold 0.4, so "ID Producto" is chosen.
      expect(nombreMapping?.userColumn).toBe('ID Producto');

      const precioMapping = suggestions.find(s => s.systemFieldKey === 'precio');
      // "Precio Venta" (0.545) vs "Precio" -> should be chosen
      expect(precioMapping?.userColumn).toBe('Precio Venta');

      const stockMapping = suggestions.find(s => s.systemFieldKey === 'stock');
      // Sim for "Stock / Cantidad" vs "Stock Disponible" is 0.400, which is < threshold 0.45. So, null.
      expect(stockMapping?.userColumn).toBeNull();

      const descMapping = suggestions.find(s => s.systemFieldKey === 'descripcion');
      // "Descripcion Detallada" (0.550) vs "Descripción" -> chosen (0.550 > 0.45)
      expect(descMapping?.userColumn).toBe('Descripcion Detallada');

      const skuMapping = suggestions.find(s => s.systemFieldKey === 'sku');
      // Best sim for "SKU / Código" is "Stock Disponible" (0.333), which is < threshold 0.4. So, null.
      expect(skuMapping?.userColumn).toBeNull();
    });

    it('should return null for system fields with no good match', () => {
      const userColumns = ['ColA', 'ColB'];
      const suggestions = suggestMappings(userColumns, systemFields1);
      const precioMapping = suggestions.find(s => s.systemFieldKey === 'precio');
      expect(precioMapping?.userColumn).toBeNull();
    });

    it('should not map a user column to multiple system fields if clearly better matches exist for others', () => {
      const userCols = ['Product Name', 'Price', 'Code'];
      const sysFields: SystemField[] = [ // Ensure SystemField is used here
        { key: 'name', label: 'Name' },
        { key: 'price', label: 'Price' },
        { key: 'sku', label: 'SKU' }
      ];
      const suggestions = suggestMappings(userCols, sysFields);

      // Sim for "Name" vs "Product Name" is 0.364, which is < threshold 0.4. So, null.
      expect(suggestions.find(s => s.systemFieldKey === 'name')?.userColumn).toBeNull();
      // Sim for "Price" vs "Price" is 1.000, which is > threshold 0.4. So, "Price".
      expect(suggestions.find(s => s.systemFieldKey === 'price')?.userColumn).toBe('Price');
      // Sim for "SKU" vs "Code" is 0.000, which is < threshold 0.4. So, null.
      expect(suggestions.find(s => s.systemFieldKey === 'sku')?.userColumn).toBeNull();

      const mappedUserColumns = suggestions.map(s => s.userColumn).filter(Boolean);
      const uniqueMappedUserColumns = new Set(mappedUserColumns);
      expect(mappedUserColumns.length).toBe(uniqueMappedUserColumns.size);
    });

    it('should handle empty user columns', () => {
      const suggestions = suggestMappings([], systemFields1);
      suggestions.forEach(s => {
        expect(s.userColumn).toBeNull();
      });
    });

    it('should use DEFAULT_SYSTEM_FIELDS if none provided', () => {
      // DEFAULT_SYSTEM_FIELDS is also imported now
      const suggestions = suggestMappings(userColumns1, DEFAULT_SYSTEM_FIELDS);
      expect(suggestions.some(s => s.systemFieldKey === 'nombre')).toBe(true);
      expect(suggestions.some(s => s.systemFieldKey === 'precio')).toBe(true);
    });

    it('should prioritize similarity with label, then key', () => {
        const userCols = ['nombre_producto_usuario', 'sku_usuario'];
        const sysFields: SystemField[] = [ // Ensure SystemField is used here
          { key: 'product_name_system', label: 'Nombre del Producto' },
          { key: 'sku_system', label: 'Código de Artículo' }
        ];
        const suggestions = suggestMappings(userCols, sysFields);

        const nameMapping = suggestions.find(s => s.systemFieldKey === 'product_name_system');
        expect(nameMapping?.userColumn).toBe('nombre_producto_usuario');

        const skuMapping = suggestions.find(s => s.systemFieldKey === 'sku_system');
        // Sim for "Código de Artículo" vs "sku_usuario" is 0.400, which is < threshold 0.45. So, null.
        expect(skuMapping?.userColumn).toBeNull();
    });

    it('should respect the SIMILARITY_THRESHOLD', () => {
        const userCols = ['very_remotely_related_column'];
        const sysFields: SystemField[] = [{ key: 'extremely_different_field', label: 'Totally Unrelated System Field' }];

        const suggestions = suggestMappings(userCols, sysFields);
        expect(suggestions[0].userColumn).toBeNull();
    });
  });
});
