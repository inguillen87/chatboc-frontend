# Local Verification + Twilio Sandbox

Fecha: 2026-05-08

Objetivo: poder probar Chatboc localmente sin gastar llamadas reales innecesarias y dejar listo el camino para validar WhatsApp/Twilio sandbox cuando backend y credenciales esten disponibles.

## 1. Verificacion frontend local

Comando principal:

```bash
npm run verify:local
```

Hace:

1. `npm run build`
2. `npm test -- --pool=threads`
3. `npm run test:e2e -- --project=chromium`

Cobertura e2e actual:

- Landing renderiza hero principal.
- Landing no dispara `GET /api/public/realtime/voice-capabilities` sin tenant/config.
- `/demo` muestra los tres pilares: gobiernos, empresas y colegios.
- Demo educativa abre workspace y muestra catalogo PDF.
- Demo degrada con respuesta guiada si el backend de chat responde 404.
- Widget abre desde landing y valida un estado funcional: selector de rubro o compositor; si entra al compositor valida WhatsApp y llamada IA.

## 2. Herramientas locales instalables por cache

Versiones verificadas con `npx`:

```bash
npm run tools:twilio:version
npm run tools:ngrok:version
```

Resultados observados:

- `twilio-cli/6.2.4`
- `ngrok version 3.39.1`

No se agregan tokens ni credenciales al repo.

## 3. WhatsApp sandbox real con Twilio

Esto requiere backend levantado localmente o deploy backend accesible. El frontend solo consume estados/links; el webhook real de WhatsApp vive en backend.

Variables que deben quedar solo en `.env` del backend o entorno seguro:

```bash
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
PUBLIC_BASE_URL=https://<ngrok-subdomain>.ngrok-free.app
```

Flujo recomendado:

1. Levantar backend local en el puerto que corresponda, por ejemplo `http://127.0.0.1:5000`.
2. Exponer backend con ngrok:

```bash
npx --yes ngrok http 5000
```

3. En Twilio Console, configurar el WhatsApp Sandbox inbound webhook apuntando al endpoint backend real. Ejemplo esperado si backend expone `/twilio/whatsapp/webhook`:

```text
https://<ngrok-subdomain>.ngrok-free.app/twilio/whatsapp/webhook
```

4. Enviar mensaje desde el numero asociado al sandbox.
5. Validar en frontend:

- Panel/widget no debe inventar labels.
- Si backend devuelve menu educativo, mostrar quick menu escolar.
- Si backend crea ticket/caso, el panel debe mostrarlo desde contratos existentes.
- Si el backend responde error envelope, mostrar estado accionable, no error tecnico crudo.

## 4. Reglas para no romper UX

- No llamar endpoints realtime globales sin tenant.
- No mostrar CTA de llamada si `support_channels.voice_call.enabled` y `realtime_voice.features.tool_calling` no vienen activos.
- Si Socket.IO no esta disponible, la UI debe seguir en modo normal/polling.
- Si demo chat falla, se muestra respuesta demo guiada y catalogo, no `Error 404`.
- No guardar tokens Twilio/OpenAI en archivos versionados.

## 5. Blockers reales para prueba sandbox completa

- Falta confirmar path exacto del webhook WhatsApp en backend.
- Falta setear credenciales Twilio en backend.
- Falta URL publica ngrok o deploy staging backend.
- Falta probar recepcion real de mensajes multimedia si el sandbox esta habilitado para esos tipos.

## 6. Typecheck actual

`npm run typecheck` todavia no queda dentro de `verify:local` porque falla por deuda TypeScript amplia no limitada al demo/widget. Los grupos principales observados:

- Props/tipos de `Badge` usados en multiples pantallas.
- Tipos de analytics exportados/importados desde `analyticsService`.
- Test files incluidos por `tsconfig.app.json` sin globals de Vitest.
- Targets/lib antiguos para `replaceAll` y WebAuthn.
- Tipos legacy de tickets/chat/cart aun no alineados con contratos v2.

Mientras tanto, la puerta local estable es `npm run verify:local`.
