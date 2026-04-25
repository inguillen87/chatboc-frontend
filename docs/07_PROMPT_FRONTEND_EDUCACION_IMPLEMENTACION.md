# Prompt · Frontend educación · implementación fundacional

```md
Trabajá SOLO en el repo chatboc-frontend sobre una branch nueva:
feat/edu-family-portal-shell

Primero leé:
- AGENTS.md
- 01_MASTER_VERTICAL_EDUCACION_SAAS.md
- 03_FRONTEND_VERTICAL_EDUCACION_CODEX.md
- 08_BACKLOG_VERTICAL_EDUCACION.yaml

Objetivo:
implementar la fundación frontend de la vertical educación sin romper el producto actual.

Alcance de esta tarea:
1. agregar shell/routing para educación
2. agregar role-based navigation base
3. construir home inicial de portal familiar
4. construir shell inicial de panel staff / inbox escolar reutilizando tickets existentes
5. agregar student/family context placeholder
6. adaptar widget actual a modo colegio público institucional
7. preparar feature flags para:
   - education_enabled
   - family_portal_enabled
   - documents_enabled
   - attendance_enabled
   - billing_enabled
   - admissions_enabled
8. dejar preparado el frontend para endpoints `/api/v1/education/*` sin romper flows actuales

Restricciones duras:
- no rediseñar toda la UI
- no romper `api.ts` / `client.ts`
- no cambiar contratos de headers
- no tocar auth profundo en esta tarea
- no implementar todavía billing/admissions completos
- no construir un portal separado desde cero
- no mezclar esta tarea con streaming/voz

Requerimientos:
- mobile-first
- role-first
- público vs verificado bien diferenciado
- reutilización explícita del inbox/tickets UI
- navegación simple
- protección UX para datos sensibles
- feature flags y fallback

Entregables obligatorios:
1. diff enfocado
2. lista de archivos modificados
3. componentes nuevos
4. rutas nuevas
5. flags
6. pruebas manuales
7. rollback plan
8. breaking changes: ninguno / lista exacta

Criterio de done:
- existe shell educación navegable
- existe family home inicial
- existe staff inbox shell inicial
- el widget puede correr en modo colegio público
- no se rompe panel/widget actual
- no se rompen contratos con backend
```
