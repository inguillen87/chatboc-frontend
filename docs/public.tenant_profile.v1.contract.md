# Contract — `public.tenant_profile.v1`

## Endpoint
- `GET /tenant-profile` (o endpoint público equivalente de bootstrap tenant)

## Respuesta esperada

```json
{
  "contract_version": "public.tenant_profile.v1",
  "tenant": {
    "slug": "mi-tenant",
    "tipo": "municipio",
    "rubro_profile": {
      "tenant_type": "education",
      "rubro_label": "colegio",
      "rubro_slug": "colegio",
      "education_profile": {
        "is_education": true,
        "institution_type": "public",
        "modules": ["asistencia", "comunicados", "agenda", "tramites"]
      }
    }
  }
}
```

## Reglas de validación FE
- `contract_version` debe ser exactamente `public.tenant_profile.v1`.
- Si el endpoint devuelve 404, FE debe mostrar estado vacío controlado + CTA soporte (sin fallback demo implícito).
- `education_profile` es opcional y solo aplica a tenants del rubro educación.

