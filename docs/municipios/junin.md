# Operaciones para el municipio de Junín

Este documento resume cómo restaurar la funcionalidad del tenant Junín en entornos de demo o post-rollbacks. Incluye autenticación, configuración, encuestas, catálogo y consideraciones de checkout para mantener la experiencia white-label.

## Autenticación y migraciones
- Asegura que el usuario `mauricio@junin.com` exista con rol de municipio y `tenant_slug` igual a `junin`.
- Si `/auth/login` devuelve 401, ejecuta las migraciones/seed que fijan la contraseña de Mauricio y crean el tenant de Junín.
- Vuelve a cargar el JSON de configuración base (`data/municipios/default/config.json`) en la base de datos si faltan datos de dirección, URLs de chat o catálogos.

## Encuestas municipales
- Usa el script `npm run seed:surveys -- --token <ADMIN_TOKEN> --municipalities "Junín Mendoza" [--publish]` para recrear las plantillas con slugs legibles (`intencion-voto-2025-junin-mendoza`, etc.).
- El script admite `--dry-run` y permite repetir la seed tras un rollback.

## Catálogos, carrito y puntos
- Ejecuta el seeder del catálogo (`ensure_seed_catalog`) asegurando que detecte el tenant/usuario "junin" o "municipalidad-de-junin" para insertar ítems demo (e.g., Kit escolar, Árbol nativo, Bono Hospital Saporiti).
- Verifica que el frontend reciba los enlaces del catálogo desde la configuración (sin hardcodear rutas) y que cada producto incluya su `modalidad` (`venta`, `donacion`, `puntos`).
- En checkout, el frontend suma y valida puntos solo para `modalidad === 'puntos'` y ajusta el saldo con `adjustPointsBalance(-pointsTotal)`; el backend debe confirmar los canjes de forma atómica y registrar donaciones como pedidos de $0.

## Widget de chat externo
- Revisa que el HTML público del widget (p.ej., `municipiojunin.html`) incluya el token y slug `junin` correctos y que `base_chat_url` apunte a la instancia de Chatboc configurada.
- Mantén los textos del widget white-label: logos, mensajes de bienvenida y enlaces deben venir del backend o del JSON de configuración (`data/municipios/junin/config.json`).

### WhatsApp oficial
- Usa siempre el número verificado `+1 743 264-3718` como `whatsapp_oficial` en la configuración del tenant `municipio`.
- Si aplicas el seed CLI sugerido para Junín, ajusta el bloque de configuración para que defina `config["whatsapp_oficial"] = "+17432643718"` antes de guardar el `TenantProfile`.
- Los enlaces de WhatsApp del widget/PWA deben construirse a partir de ese campo (por ejemplo, `https://wa.me/17432643718`).

## Buenas prácticas
- No hardcodear textos específicos de Junín en componentes React; cualquier personalización debe residir en configuración/JSON.
- Tras migraciones o seeds, validar login, carga de encuestas y catálogo, y el flujo de puntos/canje en checkout.
