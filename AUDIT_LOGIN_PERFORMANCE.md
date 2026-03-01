# AUDIT_LOGIN_PERFORMANCE

## Alcance
Auditoría frontend sobre `Login.tsx` y comportamiento post-auth en shell.

## Hallazgos
1. **Bloqueo innecesario en passkey login**: el flujo esperaba `refreshUser()` antes de navegar, penalizando tiempo percibido de ingreso.
2. **Preloads demo bloqueantes**: `runDemoPreloadHints` frenaba la autenticación demo aun siendo datos no críticos.
3. **Acoplamiento parcial auth/bootstrap**: algunas rutas siguen refrescando perfil tras login, pero ya en background.

## Cambios aplicados
- Passkey: navegación inmediata por rol del resultado de auth + `refreshUser()` en background.
- Demo login: preload hints en modo no bloqueante (`void ...`).

## Métrica before/after (frontend percibido)
- **Before**: la transición a pantalla destino esperaba parte de bootstrap.
- **After**: la navegación ocurre inmediatamente tras token/rol; la hidratación de perfil queda asíncrona.

## Próximos pasos backend (recomendado)
- Endpoint de login con bootstrap mínimo explícito.
- Trazas por etapa: `auth_ms`, `me_ms`, `tenant_bootstrap_ms`.
- Cache de contrato demo/tenant.
