# Especificaciones Backend - Módulo Pedidos y Chatboc Comercio

Este documento detalla los requerimientos de backend (Flask + SQLAlchemy) para implementar el "Núcleo de Pedidos" de Chatboc, integrando MercadoLibre, TiendaNube y WhatsApp.

## 1. Modelo de Datos (SQLAlchemy)

### `IntegracionCuenta`
Almacena las credenciales y estado de conexión por tenant y proveedor.

```python
class IntegracionCuenta(db.Model):
    __tablename__ = 'integracion_cuentas'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.String, db.ForeignKey('tenants.id'), nullable=False)
    proveedor = db.Column(db.String(50), nullable=False) # 'mercadolibre', 'tiendanube'
    estado = db.Column(db.String(20), default='desconectado') # 'conectado', 'desconectado', 'error'

    access_token = db.Column(db.String(255))
    refresh_token = db.Column(db.String(255))
    token_expires_at = db.Column(db.DateTime)

    metadata_json = db.Column(db.JSON) # user_id externo, store_id, etc.

    # Configuración de notificaciones para el dueño
    owner_phone = db.Column(db.String(50)) # Para WhatsApp
    telegram_chat_id = db.Column(db.String(50)) # Para Telegram
    notification_settings = db.Column(db.JSON) # { "whatsapp": true, "telegram": true, "email": false }
```

### `Pedido`
La entidad central unificada. Representa una venta, provenga de donde provenga.

```python
class Pedido(db.Model):
    __tablename__ = 'pedidos'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.String, db.ForeignKey('tenants.id'), nullable=False)

    canal = db.Column(db.String(50)) # 'whatsapp', 'mercadolibre', 'tiendanube', 'web'
    estado = db.Column(db.String(50), default='nuevo') # 'nuevo', 'confirmado', 'preparado', 'despachado', 'entregado', 'cancelado'

    # Datos del Cliente
    cliente_nombre = db.Column(db.String(100))
    cliente_telefono = db.Column(db.String(50)) # Clave para WhatsApp
    cliente_email = db.Column(db.String(100))

    total = db.Column(db.Numeric(10, 2))
    moneda = db.Column(db.String(3), default='ARS')

    nota = db.Column(db.Text) # Observaciones internas o del cliente

    # Referencias Externas
    externo_proveedor = db.Column(db.String(50)) # 'mercadolibre', 'tiendanube', None
    externo_order_id = db.Column(db.String(100))
    externo_url = db.Column(db.String(255)) # Link directo a la orden en la plataforma externa

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
```

### `PedidoItem`
Detalle de productos del pedido.

```python
class PedidoItem(db.Model):
    __tablename__ = 'pedido_items'

    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedidos.id'), nullable=False)

    sku = db.Column(db.String(100))
    producto_nombre = db.Column(db.String(255))
    cantidad = db.Column(db.Integer)
    precio_unitario = db.Column(db.Numeric(10, 2))
```

### `EventoIntegracion`
Log de webhooks para idempotencia y debugging.

```python
class EventoIntegracion(db.Model):
    __tablename__ = 'eventos_integracion'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.String, nullable=True)
    proveedor = db.Column(db.String(50))

    event_id = db.Column(db.String(100), unique=True) # ID único del evento externo
    tipo = db.Column(db.String(50)) # 'order_created', 'order_updated', etc.
    payload_json = db.Column(db.JSON)

    procesado_ok = db.Column(db.Boolean, default=False)
    error = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

## 2. Endpoints API

### Pedidos (Gestión Interna)
*   `GET /api/tenant/{tenant_id}/pedidos?estado=&canal=` - Listado filtrable.
*   `GET /api/tenant/{tenant_id}/pedidos/{pedido_id}` - Detalle completo.
*   `POST /api/tenant/{tenant_id}/pedidos` - Crear pedido manual o desde WhatsApp.
*   `PUT /api/tenant/{tenant_id}/pedidos/{pedido_id}` - Actualizar estado o notas.
*   `POST /api/tenant/{tenant_id}/pedidos/{pedido_id}/items` - Agregar items.

### Integraciones (OAuth y Config)
*   `POST /api/tenant/{tenant_id}/integraciones/{proveedor}/connect` - Genera y devuelve URL OAuth.
*   `GET /api/integraciones/{proveedor}/callback` - Endpoint público para recibir el `code` de la plataforma, obtener tokens y guardarlos en `IntegracionCuenta`.
*   `PUT /api/tenant/{tenant_id}/integraciones/notifications` - Actualizar `owner_phone`, `telegram_chat_id` y preferencias.

### Webhooks (Recepción de Eventos)
*   `POST /api/webhooks/{proveedor}`
    *   Valida firma/secreto.
    *   Guarda en `EventoIntegracion` (verificando `event_id` para evitar duplicados).
    *   Dispara procesamiento (síncrono o worker): `mapear_orden_a_pedido()`.

## 3. Lógica de Integración y Notificaciones

### Mapper: Orden Externa -> Pedido Interno
Función `mapear_orden_ml_a_pedido(payload)`:
1.  Busca si existe `Pedido` con `externo_order_id`.
2.  **Si NO existe**: Crea `Pedido` + `PedidoItem`.
    *   Dispara notificación al dueño (ver abajo).
3.  **Si existe**: Actualiza estado, total, o notas si cambiaron.

### Notificaciones al Dueño (Push)
Implementar función `notify_owner(pedido)` que se ejecuta al crear un pedido nuevo.

**Lógica de envío:**
1.  Leer configuración del tenant (`owner_phone`, `telegram_chat_id`, toggles).
2.  **Telegram (Recomendado/Gratis)**:
    *   Si `telegram_chat_id` existe y está activo:
    *   `POST https://api.telegram.org/bot<TOKEN>/sendMessage`
    *   Texto: "🧾 Nuevo pedido #{id} – Total ${total} – {items_count} ítems – Ver: https://app.chatboc.ar/pyme/{slug}/pedidos/{id}"
3.  **WhatsApp (Twilio)**:
    *   Si `owner_phone` existe y toggle WhatsApp activo:
    *   Usar plantilla aprobada (`content_sid`) para iniciar conversación fuera de ventana de 24h.
    *   Plantilla Utility sugerida: "Nuevo pedido #{1}. Total: ${2}. Ver detalle: {3}"

## 4. Estrategia de Catálogo "Espejo"
El Marketplace de Chatboc actúa como vidriera central.
*   Productos pueden tener `checkout_type`: 'mercadolibre', 'tiendanube', 'chatboc'.
*   Al hacer clic en "Comprar", el frontend redirige a la URL externa o inicia el checkout interno según corresponda.
*   Esto mantiene el tráfico y la experiencia en Chatboc hasta el momento del pago.
