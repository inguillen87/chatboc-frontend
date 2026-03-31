# Repo frontend — backlog ejecutable para Codex

## Objetivo
Elevar la experiencia a estándar enterprise: inbox unificado, operación omnicanal, admin robusto, PWA mobile-first y widget embebible serio.

## Reglas de implementación
- No hardcodear permisos en UI.
- Consumir contratos versionados del backend.
- Todo realtime debe degradar a polling o refetch.
- Toda UI debe contemplar estados: loading, empty, partial, denied, offline, stale.
- Mobile-first de verdad, no “desktop encogido”.

---

## Epic FE-01 — App shell enterprise

### Entregables
- layout principal con navegación estable
- patrones comunes de loading/error/empty states
- manejo central de permisos y capacidades
- `react-query` bien estructurado por dominios

### Criterios de aceptación
- no hay pantallas huérfanas
- toda ruta sensible valida permisos
- la app soporta refresh y deep-link sin perder contexto

---

## Epic FE-02 — Inbox unificado omnicanal

### Entregables
- vista de conversaciones
- filtros por canal/estado/área/agente/prioridad
- timeline omnicanal unificado
- drawer o panel de detalle
- composer contextual por canal

### Requisitos UX
- distinguir claramente web/whatsapp/voice/email/admin note
- mostrar eventos de linking y handoff
- mostrar SLA, prioridad y asignación
- permitir continuidad sin cambiar de módulo

### Criterios de aceptación
- el operador entiende el historial completo en una vista
- cambiar de canal no rompe el contexto
- asignar/reasignar queda visible y coherente

---

## Epic FE-03 — Live chat y bridge admin

### Entregables
- sala de chat en vivo ligada a `conversation_id`
- indicadores de presencia/estado humano
- fallback si socket falla
- composer con adjuntos y notas internas

### Criterios de aceptación
- el admin puede continuar una conversación que empezó en WhatsApp o widget
- si cae realtime, la UI sigue operando con revalidación
- las notas internas no se mezclan con mensajes al usuario

---

## Epic FE-04 — Roles, empleados, organizaciones grandes

### Entregables
- pantallas para org units
- pantallas para equipos
- CRUD de empleados/usuarios
- asignación de roles y scopes
- vista de auditoría básica

### Criterios de aceptación
- se puede modelar municipio/empresa grande con jerarquía
- los permisos visibles en UI reflejan backend, no inventan lógica aparte
- exportaciones y acciones sensibles muestran restricciones

---

## Epic FE-05 — Notification center + templates

### Entregables
- inbox/centro de notificaciones operativas
- gestión de plantillas por canal
- estados de envío, retry, fallas
- vista de preferencias y quiet hours si aplica

### Criterios de aceptación
- el operador entiende qué salió, qué falló y por qué
- WhatsApp muestra si usó template o no
- plantillas se pueden probar y versionar desde admin

---

## Epic FE-06 — Analytics consultoría

### Entregables
- dashboard ejecutivo
- dashboard operativo
- diccionario visible de KPIs
- filtros persistentes por tenant/canal/zona/categoría/fecha
- export gobernado

### KPIs mínimos visibles
- FRT
- ART
- resolución
- backlog
- SLA breach
- deflection
- CSAT
- NPS

### Criterios de aceptación
- los números tienen definición visible
- filtros no generan incoherencias entre widgets
- export respeta permisos y queda auditado

---

## Epic FE-07 — Heatmaps y analítica geoespacial

### Entregables
- capas seleccionables
- leyenda clara
- filtros por categoría/severidad/estado/canal
- zoom adaptativo
- tooltips con privacidad segura
- vista de rutas/cuadrillas si existe backend listo

### Criterios de aceptación
- no hay sobrecarga visual
- los mapas son útiles para decisión operativa, no decorativos
- el usuario entiende qué está viendo y con qué filtros

---

## Epic FE-08 — Encuestas/votaciones enterprise

### Entregables
- panel de administración de encuestas
- publicación/cierre con confirmaciones fuertes
- resultados realtime + fallback
- vista de integridad/anomalías/resumen metodológico

### Criterios de aceptación
- la UI transmite confianza y gobierno
- publicar/cerrar/exportar exige permisos correctos
- realtime no bloquea el uso si falla

---

## Epic FE-09 — PWA mobile-first seria

### Entregables
- lifecycle de service worker más robusto
- update prompt consistente
- offline fallback page
- colas de acciones diferidas cuando aplique
- manifest completo con iconos correctos y maskable
- ajustes de accesibilidad clave

### Criterios de aceptación
- instalación limpia en mobile
- comportamiento razonable con mala conectividad
- refresh/update no rompe sesión ni trabajo del agente

---

## Epic FE-10 — Widget embebible enterprise

### Entregables
- soporte multi-instancia
- no destruir estado por default
- mejor compatibilidad con SPA host
- permisos de sandbox mínimos por feature
- CTA “continuar en WhatsApp”
- CTA “continuar por llamada”
- linking visual por código/OTP/QR

### Criterios de aceptación
- múltiples widgets pueden convivir
- el host puede navegar sin matar conversaciones innecesariamente
- el usuario puede mover la conversación a WhatsApp o llamada con continuidad real

---

## Epic FE-11 — Design system operacional

### Entregables
- tokens y componentes comunes para estados operativos
- tablas enterprise reutilizables
- paneles/filtros estandarizados
- accesibilidad base corregida en flujos críticos

### Criterios de aceptación
- la plataforma deja de parecer “pantallas sueltas”
- los módulos nuevos usan patrones consistentes
- mobile y desktop comparten lenguaje visual coherente

---

## Orden sugerido de PRs
1. FE-01 app shell
2. FE-02 inbox omnicanal
3. FE-03 live chat/admin bridge
4. FE-04 roles y organizaciones
5. FE-05 notifications/templates
6. FE-06 analytics consultoría
7. FE-07 heatmaps
8. FE-08 encuestas/votaciones
9. FE-09 PWA
10. FE-10 widget
11. FE-11 design system operacional

---

## Prompt base para Codex en frontend
"""
Trabajá únicamente en el repo frontend.
Objetivo: implementar [EPIC_ID] consumiendo contratos existentes del backend y evitando cambios cosméticos sin impacto operativo.

Antes de cambiar código:
1. identificar rutas, pantallas, stores/hooks y componentes afectados
2. proponer plan corto
3. listar estados UX a cubrir: loading, empty, error, denied, offline

Restricciones:
- no hardcodear permisos
- degradación sin realtime obligatoria
- mantener mobile-first
- usar componentes/patrones existentes si sirven; crear nuevos sólo si mejora consistencia
- agregar tests donde el repo ya tenga patrón
- no tocar backend

Entregables:
- código
- tests si aplica
- notas de UX
- lista de endpoints consumidos
"""
