# Especificación Backend - Super Admin SaaS

Este documento define los requisitos para implementar la gestión centralizada de tenants (Super Admin) en el backend.

## 1. Rol `super_admin`

Se debe crear un nuevo rol `super_admin` en la base de datos.
Este rol tiene permisos globales y puede:
- Ver todos los tenants.
- Crear nuevos tenants.
- Modificar planes y estados de tenants.
- Acceder a cualquier configuración de tenant.

### Seed Script
Crear un script `scripts/create_super_admin.py` (o equivalente) que permita crear el usuario inicial:
```bash
python scripts/create_super_admin.py --email ceo@chatboc.ar --password "SECRETO_CEO"
```

## 2. Endpoints de Gestión de Tenants

Estos endpoints deben estar protegidos y requerir el rol `super_admin`.

### 2.1 Listar Tenants
**GET** `/api/admin/tenants`

Devuelve una lista paginada de todos los tenants registrados.

**Respuesta:**
```json
[
  {
    "id": 1,
    "slug": "junin",
    "nombre": "Municipalidad de Junín",
    "tipo": "municipio",
    "plan": "full",
    "status": "active",
    "created_at": "2023-01-01T12:00:00Z"
  },
  {
    "id": 2,
    "slug": "pyme-ejemplo",
    "nombre": "Mi Pyme S.A.",
    "tipo": "pyme",
    "plan": "free",
    "status": "inactive",
    "created_at": "2023-06-15T10:30:00Z"
  }
]
```

### 2.2 Actualizar Estado/Plan
**PUT** `/api/admin/tenants/<slug>/status`

Permite cambiar el plan o activar/desactivar un tenant.

**Body:**
```json
{
  "plan": "pro",
  "status": "active"
}
```

## 3. Integración con Autenticación Existente

Asegurar que el middleware de autenticación reconozca el rol `super_admin` y le permita saltarse las verificaciones de pertenencia a un tenant específico cuando accede a rutas administrativas globales.

## 4. Lógica de "Self-Service" (Autoconsumo)

Cuando un usuario normal (rol `admin` de un tenant) paga una suscripción:
1. El backend recibe el webhook de pago.
2. Actualiza el campo `plan` del tenant a `full` o `pro`.
3. Esto habilita automáticamente el acceso a `/integracion` en el frontend (ya implementado en el frontend, verificar lógica de backend si hay guards).
