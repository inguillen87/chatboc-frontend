# Frontend to Backend - Marketplace e Inventario Pro

Fecha: 2026-05-17

## Objetivo

Unificar catalogo, marketplace, carrito, pedidos, WhatsApp, widget y panel admin para que el frontend no calcule stock, precios finales ni disponibilidad comercial. El backend debe publicar el estado real y la trazabilidad de cada operacion.

## Regla principal

Frontend no confirma stock, precio final, envio, checkout ni pedido si backend no lo valida. En demo se puede mostrar el flujo, pero la confirmacion debe quedar marcada como demo o deshabilitada.

## 1. Demos

Cuando `demo_mode=true`:

- El catalogo demo puede mostrar recursos ilustrativos y descargables.
- Los botones de pedido muestran el flujo conversacional dentro del chat.
- No confirmar stock real, inventario, precio final ni disponibilidad comercial.
- No fabricar checkout, comprobantes, recibos, promociones ni totales.
- Si backend devuelve `amount_validated: false`, frontend no muestra monto final confirmado.
- Si backend devuelve `stock_status: "stock_unknown"` u `"out_of_stock"`, widget y WhatsApp no confirman compra.

Respuesta recomendada para pedido demo:

```json
{
  "success": true,
  "request_id": "req_...",
  "message": "Puedo tomar los datos del pedido para mostrarte el flujo. La confirmacion comercial queda deshabilitada en demo.",
  "data": {
    "order": {
      "status": "demo_pending_confirmation",
      "amount_validated": false,
      "stock_status": "stock_unknown",
      "items": []
    }
  }
}
```

Politica recomendada en contratos demo:

```json
{
  "demo_mode": true,
  "inventory_policy": {
    "real_stock": false,
    "confirm_orders": false,
    "message": "Esta demo no confirma stock real."
  }
}
```

## 2. Tenants Pagos

Admin, widget, WhatsApp, chat profesional, carrito y pedidos deben usar el mismo catalogo backend.

Campos esperados por producto:

- `id`
- `catalogo_item_id`
- `sku`
- `name` o `nombre`
- `description` o `descripcion`
- `price` o `precio`
- `price_numeric`
- `currency` o `moneda`
- `stock`
- `stock_quantity`
- `stock_status`
- `available_to_sell`
- `inventory`
- `catalog_version`
- `request_id`

Reglas:

- Frontend renderiza estos campos cuando vienen publicados.
- Frontend no calcula stock ni precio final.
- Pedido confirmado requiere validacion backend en el ultimo paso.
- Si `available_to_sell === false`, no mostrar accion de compra confirmada.
- Si `stock_status` es `stock_unknown` u `out_of_stock`, mostrar consulta o lead, no compra cerrada.

Politica recomendada en contratos Pro:

```json
{
  "demo_mode": false,
  "inventory_policy": {
    "real_stock": true,
    "confirm_orders": "backend_validated",
    "catalog_version": "cat_..."
  }
}
```

## 3. Endpoints A Consumir

```txt
GET /api/admin/tenants/{tenant_slug}/catalog
GET /api/admin/tenants/{tenant_slug}/catalog/items
PATCH /api/admin/tenants/{tenant_slug}/catalog/items/{item_id}
POST /api/admin/catalog/import
GET /api/admin/catalog/import/{upload_id}
PUT /api/admin/catalog/import/{upload_id}
POST /api/admin/catalog/import/{upload_id}/commit
GET /api/v2/tenants/{tenant_slug}/catalog/quality
```

`GET /api/admin/tenants/{tenant_slug}/catalog` publica:

```json
{
  "contract_version": "tenant.catalog_admin.v1",
  "request_id": "req_...",
  "tenant_slug": "bodega",
  "catalog_version": "cat_1_20260517103000",
  "status": "published",
  "links": {
    "items_endpoint": "/api/admin/tenants/bodega/catalog/items",
    "item_patch_template": "/api/admin/tenants/bodega/catalog/items/{item_id}",
    "bulk_import_v2": "/api/admin/catalog/import",
    "stock_only_import_v2": "/api/admin/catalog/import",
    "quality_endpoint": "/api/v2/tenants/bodega/catalog/quality"
  },
  "inventory": {
    "contract_version": "catalog.inventory_ops.v1",
    "enabled": true,
    "columns": {
      "stock_columns": ["stock_quantity", "stock", "cantidad", "existencias", "inventory", "inventario", "available_quantity", "qty"],
      "supported_import_modes": ["upsert", "replace", "stock_only"]
    },
    "rules": {
      "demo_mode": false,
      "chat_confirms_stock_only_after_backend_validation": true,
      "frontend_must_not_invent_availability": true
    }
  },
  "frontend_contract": {
    "render_as": "tenant_catalog_inventory_admin",
    "primary_view": "catalog_and_inventory",
    "supports_inline_stock_edit": true,
    "supports_bulk_import": true,
    "supports_stock_only_import": true,
    "supports_quality_board": true
  }
}
```

## 4. Edicion Manual De Stock

`PATCH /api/admin/tenants/{tenant_slug}/catalog/items/{item_id}`

Body soportado:

```json
{
  "stock_quantity": 18,
  "precio": "1500",
  "disponible": true,
  "available_to_sell": true,
  "inventory_source": "tenant_admin_inline_edit"
}
```

Respuesta:

```json
{
  "contract_version": "tenant.catalog_item_update.v1",
  "request_id": "req_...",
  "catalog_version": "cat_1_20260517103000",
  "item": {
    "id": 123,
    "catalogo_item_id": 123,
    "sku": "SKU-001",
    "name": "Producto",
    "nombre": "Producto",
    "price": 1500,
    "price_numeric": 1500,
    "currency": "ARS",
    "stock_quantity": 18,
    "stock_status": "in_stock",
    "available_to_sell": true,
    "inventory": {}
  }
}
```

Reglas frontend:

- Mostrar guardado optimista solo como pendiente.
- Confirmar el nuevo valor solo con la respuesta backend.
- Si cambia `catalog_version`, refrescar tabla, cards, widget y cache de WhatsApp.

## 5. Importacion

Modos esperados:

- `upsert`: actualiza por SKU y crea faltantes.
- `replace`: reemplaza catalogo del tenant.
- `stock_only`: actualiza solo stock por SKU y no crea productos nuevos.

Payload recomendado:

```json
{
  "tenant_slug": "bodega",
  "mode": "stock_only",
  "source": "admin_upload",
  "mapping": {
    "sku": "SKU",
    "stock_quantity": "Stock",
    "price": "Precio"
  }
}
```

Preview recomendado:

```json
{
  "contract_version": "catalog.import_preview.v1",
  "request_id": "req_...",
  "upload_id": "upl_...",
  "quality_summary": {},
  "inventory_summary": {
    "contract_version": "catalog.inventory_summary.v1",
    "total_rows": 50,
    "with_stock": 46,
    "stock_unknown": 4,
    "low_stock": 3,
    "out_of_stock": 2
  },
  "commit_endpoint": "/api/admin/catalog/import/upl_.../commit",
  "frontend_contract": {
    "render_as": "catalog_import_preview",
    "editable_rows": true,
    "publish_requires_admin_confirmation": true
  }
}
```

Respuesta recomendada de commit:

```json
{
  "ok": true,
  "success": true,
  "contract_version": "catalog.import_commit.v1",
  "request_id": "req_...",
  "upload_id": "upl_...",
  "mode": "stock_only",
  "summary": {
    "created": 0,
    "updated": 120,
    "skipped": 3,
    "errors": 0
  },
  "created": 0,
  "updated": 120,
  "stock_updated": 120,
  "skipped_rows": [
    { "sku": "NO-EXISTE", "reason_code": "sku_not_found_for_stock_only_import" }
  ],
  "catalog_version": "cat_1_20260517103000",
  "warnings": []
}
```

## 6. Calidad Del Catalogo

`GET /api/v2/tenants/{tenant_slug}/catalog/quality` debe devolver datos accionables para admin:

```json
{
  "contract_version": "catalog.quality.v1",
  "request_id": "req_...",
  "tenant_slug": "bodega",
  "catalog_version": "cat_2026_05_17",
  "summary": {
    "items_total": 320,
    "items_sellable": 280,
    "missing_price": 12,
    "stock_unknown": 44,
    "missing_images": 31
  },
  "recommendations": [
    {
      "id": "stock_unknown",
      "label": "Completar stock",
      "description": "Hay productos sin estado de stock validado.",
      "severity": "warning"
    }
  ]
}
```

Tambien puede conservar aliases historicos como `summary.products`, `summary.ready_to_sell` y `recommended_actions`.

## 7. Widget Y WhatsApp

Para acciones comerciales dentro del chat:

- `consultar_producto`: backend responde precio/disponibilidad si existe.
- `crear_pedido`: backend pide datos y valida pedido.
- `cotizar_envio`: backend calcula o publica cotizacion; frontend no calcula.
- `capturar_lead_comercial`: backend crea lead/ticket trazable.

Respuesta de pedido confirmado:

```json
{
  "success": true,
  "request_id": "req_...",
  "message": "Pedido confirmado.",
  "data": {
    "order": {
      "order_id": "O-123",
      "status": "confirmed",
      "amount_validated": true,
      "stock_status": "validated",
      "total": 12500,
      "currency": "ARS",
      "items": [
        {
          "sku": "SKU-1",
          "name": "Producto",
          "quantity": 2,
          "price": 6250
        }
      ]
    }
  }
}
```

Si no hay validacion:

```json
{
  "success": true,
  "request_id": "req_...",
  "message": "Solicitud registrada. El equipo va a validar stock y precio.",
  "data": {
    "order": {
      "status": "pending_validation",
      "amount_validated": false,
      "stock_status": "stock_unknown"
    }
  }
}
```

Reglas:

- Catalogo descargable puede abrir link externo.
- Consultar producto, stock, precio, pedido y checkout siguen dentro del chat.
- El chat solo muestra disponibilidad publicada por backend.
- Si `stock_status === "stock_unknown"`, responder "stock a confirmar" y crear lead/pedido borrador, no pedido confirmado.
- Si `stock_status === "out_of_stock"`, ofrecer alternativas backend o derivar humano.
- Si el usuario pide mas unidades que `stock_quantity`, backend debe bloquear o pedir validacion humana.

## 8. Gobiernos Y Colegios

No forzar lenguaje comercial cuando no corresponde.

Gobierno puede usar el mismo contrato para:

- cupos de turnos o entregas,
- kits municipales,
- materiales o recursos publicados,
- productos de economia local,
- stock de programas o beneficios.

Colegios pueden usarlo para:

- uniformes,
- libros,
- talleres,
- eventos,
- cuotas/matriculas como conceptos,
- certificados o recursos descargables.

Frontend debe leer labels del backend. Si el tenant es gobierno/colegio, usar recursos, cupos, conceptos o catalogo escolar cuando backend lo publique; no llamar todo "producto" por defecto.

## 9. UX/UI Para Frontend Tenant Admin

Pantalla: Catalogo e inventario.

Secciones minimas:

- Cards: productos publicados, listos para vender, sin precio, sin stock, bajo stock, agotados, ultima importacion.
- Tabla editable: SKU, nombre, categoria, precio, stock, estado, visible, ultima actualizacion.
- Edicion inline de stock y precio con estado guardando.
- Filtros: categoria, `stock_status`, sin precio, sin imagen, actualizado hace mas de X dias.
- Bulk upload wizard:
  - Subir CSV/XLSX/PDF.
  - Mapear columnas.
  - Preview con filas creadas/actualizadas/error.
  - Commit `upsert`, `replace` o `stock_only`.
  - Resultado con `request_id`, `catalog_version` y filas omitidas.
- Acciones por item: editar, ocultar, subir imagen, ver en widget, copiar link, historial.
- Badges visibles: Sin stock, Bajo stock, Stock sin validar, Precio faltante, No publicado.

## 10. QA Compartida

1. Tenant pago actualiza stock con `PATCH`.
2. Import `stock_only` actualiza stock por SKU y no crea productos nuevos.
3. Widget consulta producto y muestra solo precio/stock publicados por backend.
4. Widget no confirma compra si `stock_status` es `stock_unknown` u `out_of_stock`.
5. WhatsApp no confirma compra sin `amount_validated: true`.
6. Demo muestra flujo comercial pero no confirma stock/precio real.
7. Export o resumen admin incluye `catalog_version` y `request_id`.
8. Admin ve `items_total`, `items_sellable`, `stock_unknown`, `missing_price` y `missing_images`.
9. Gobierno y colegio no muestran texto comercial si backend publica labels verticales.
10. Cada import, patch y confirmacion conserva `request_id`.
