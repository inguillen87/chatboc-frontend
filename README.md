# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/a97ee1e3-5a88-429f-8969-dcd039ee2482

## How can I edit this code?

There are several ways of editing your application.

echo "// redeploy trigger" >> README.md

Simply visit the [Lovable Project](https://lovable.dev/projects/a97ee1e3-5a88-429f-8969-dcd039ee2482) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev

# Step 5: Create a production build.
npm run build

# If `npm run dev` or `npm run build` fails with `vite: not found`,
# make sure you've run `npm install` (or `npm ci`) to install dependencies.
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Configuration

The chat interface defaults to the "municipio" style. To switch to the
"pyme" variant, set `VITE_APP_TARGET=pyme` in your environment or `.env`
file before running `npm run dev`.

### Timezone and locale

All dates are formatted using the timezone from `VITE_TIMEZONE` and the locale
from `VITE_LOCALE`. These values default to the Argentinian settings
`America/Argentina/Buenos_Aires` (GMT‑3) and `es-AR`. To display times for a
different country, override the variables in your `.env` file:

```bash
# .env
VITE_TIMEZONE=America/Santiago
VITE_LOCALE=es-CL
```

The `DateSettingsProvider` also reads any `timezone` or `locale` stored in
`localStorage`, so user preferences persist across sessions.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/a97ee1e3-5a88-429f-8969-dcd039ee2482) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Embedding the Chatboc widget



This snippet loads the widget without needing an iframe and creates a floating bubble styled just like on chatboc.ar.
You can also pass `data-theme="dark"` or `data-theme="light"` to force a specific theme inside the widget.
If you host `widget.js` yourself, remember to add `data-domain="https://chatboc.ar"` so the iframe loads from our servers. Example self-hosted snippet:

```html

```
Using `widget.js` from another domain **without** this attribute causes the iframe
to load its scripts from the wrong origin, leading to console errors and 403
responses from `https://api.chatboc.ar`. If you see messages such as `attribute
cx: Expected length` or `Access Forbidden`, verify that `data-domain` is set to
`https://chatboc.ar`.
The script automatically adds `allow="clipboard-write; geolocation; microphone; camera"` to the underlying iframe so the widget can request GPS or media access.
If your site embeds this script inside another `<iframe>`, be sure that outer frame also includes
`allow="clipboard-write; geolocation; microphone; camera"`. The permission must be granted at every level
for the browser to allow geolocation requests inside the widget.

### Customization

The `<script>` tag accepts several extra `data-*` attributes to control the widget's look:

- `data-bottom` and `data-right` – offset from the bottom-right corner (`20px` by default).

- `data-default-open="true"` – open the chat automatically when the page loads.
- `data-width` / `data-height` – size of the open chat window (defaults to `460px` × `680px`).
- `data-closed-width` / `data-closed-height` – size of the closed bubble (`96px` × `96px`).
- `data-z` – base `z-index` if you need to adjust stacking order.
- `data-domain` – custom domain hosting the widget, if different from `chatboc.ar`.
- `data-rubro` – optional category so the chat knows the business type from the start.
- `data-cta-message` – optional text that appears once as a bubble inviting the user to open the chat.
- `data-shadow-dom="true"` – isolates the widget styles from the host page.

### Attention bubble rotation

Set `ATTENTION_BUBBLE_CHOICES` on the server with multiple phrases separated by `|`:

```bash
ATTENTION_BUBBLE_CHOICES="¿Necesitás ayuda?|¡Chateá con nosotros!|Envianos tu consulta"
```

The `/widget/attention` endpoint returns one of these phrases at random. If the variable is missing, the default message `¿Necesitás ayuda?` is used.

### Iframe fallback

If your site blocks external JavaScript, you can embed the chatbot using an
`<iframe>` instead. Replace `TU_TOKEN_AQUI` with your token:

```html
<iframe
  id="chatboc-iframe"
  src="https://chatboc.ar/iframe.html?entityToken=TU_TOKEN_AQUI&endpoint=pyme&rubro=comercio" <!-- or "municipio"; `tipo_chat` also works -->
  style="position:fixed;bottom:24px;right:24px;border:none;border-radius:50%;z-index:9999;box-shadow:0 4px 32px rgba(0,0,0,0.2);background:transparent;overflow:hidden;width:96px!important;height:96px!important;display:block"
  allow="clipboard-write; geolocation; microphone; camera"
  loading="lazy"
></iframe>
<script>

    // If you load this snippet more than once (e.g. in a SPA)
    // call `window.chatbocDestroyWidget('<TOKEN>')` before
    // inserting a new iframe to avoid duplicates.
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'chatboc-state-change') {
        if (e.data.dimensions) {
          f.style.width = e.data.dimensions.width;
          f.style.height = e.data.dimensions.height;
        }
        f.style.borderRadius = e.data.isOpen ? '16px' : '50%';
      }
    });
  });
</script>
```
When embedding via `<iframe>`, include `allow="clipboard-write; geolocation; microphone; camera"`
so the widget can request GPS or media permissions from the browser. If this snippet is
loaded inside another `<iframe>`, that outer frame must have the same `allow`
attribute. Without these permissions the browser will block GPS, audio or camera access and
users will need to enter their address manually or skip media features.

### Removing an existing widget
If your site loads the script multiple times (for example when navigating a SPA), call `window.chatbocDestroyWidget('<TOKEN>')` before injecting a new one.
This ensures only one widget per token remains active.

From version X.X onward, `widget.js` automatically ignores duplicate script tags
for the same token. To reload the widget manually, include
`data-force="true"` on the `<script>` tag or call
`window.chatbocDestroyWidget('<TOKEN>')` before reinserting it.


## Live ticket location

The application displays a map only when the backend provides location
information. Each ticket must include either numeric `latitud` and
`longitud` fields or a text `direccion`. While a ticket chat is open,
the frontend polls `/tickets/{tipo}/{id}` every ten seconds and updates
the map with any new coordinates received. If no coordinates are
returned, the map remains hidden.

To see real‑time tracking, ensure the backend periodically sends the
current coordinates for each ticket. Once those values are present, the
map will refresh automatically without additional frontend changes.

## Admin profile map

The `/perfil` page also embeds a Google Map when the backend includes
either a `direccion` or the coordinates `latitud` and `longitud`.
Address selection uses the `AddressAutocomplete` component powered by
Google Places. Once an address is chosen, an interactive map with a
draggable marker appears so the user can fine‑tune the coordinates.
Make sure to define `VITE_Maps_API_KEY` in your `.env` file so the map
script loads correctly. If the backend does not provide any location
data, the map remains hidden as specified in [`AGENTS.md`](AGENTS.md).



## Product catalog API

Any endpoint that returns products (e.g. `/catalogo`, `/productos`, `/ask/municipio` or `/ask/pyme`)
should provide a list of objects with clear fields ready to display. Each
product includes at least:

- `nombre` — full product name
- `categoria` — main category or rubro
- `presentacion` — unit, pack, etc.
- `precio_unitario` — unit price (or `null` to indicate "Consultar precio")

Optional fields like `descripcion`, `sku`, `talles`, `colores`, `precio_pack`,
`stock`, `marca` and `imagen_url` can be included when available. The frontend
simply renders these values without extra parsing.

## Configuring the UI mode

Set the `VITE_APP_TARGET` environment variable to choose between the
municipality-oriented interface and the business (pyme) layout. Create a `.env`
file based on `.env.example` and adjust the value:

```bash
# .env
VITE_APP_TARGET=municipio
```

Running `npm run dev` will then load the municipal chat components.

### Chat type parameter

Requests to the bot should target `/ask/municipio` or `/ask/pyme`.
Choose the endpoint based on the business sector or use the
`tipo_chat` field to override the decision.
The rubro and `tipo_chat` must always align: if the rubro is listed as
public in the backend, use the municipio endpoint and layout; for any
other rubro, use pyme. Any mismatch will trigger an error from the
backend.
To decide correctly, inspect the `esPublico` flag returned by `/perfil`
or the rubros endpoint. When `esPublico` is `true`, send the request to
`/ask/municipio` and set `tipo_chat` to `municipio`; otherwise use
`/ask/pyme` and `tipo_chat` set to `pyme`.

### Local API proxy

To avoid CORS issues while developing, the Vite dev server proxies any
request starting with `/api` to `https://api.chatboc.ar`. Create your
own `.env` file from `.env.example` and ensure it contains:

```bash
VITE_API_URL=/api
```

Running `npm install` will automatically copy `.env.example` to `.env` if the
file does not exist. You can also run `npm run setup-env` manually to create it.

With this setting all frontend requests go through the proxy, so your
local environment can talk to the production API without cross-origin
errors.

If municipal pages like `/municipal/usuarios` or `/municipal/stats` respond with
`404 Not Found`, ensure your backend version exposes those endpoints and that
you are logged in with an `admin` or `empleado` account. Older deployments may
lack these routes.

### Google authentication

Social login now uses [`@react-oauth/google`](https://www.npmjs.com/package/@react-oauth/google).
Provide your OAuth client ID through `VITE_GOOGLE_CLIENT_ID` in your `.env` file (note the `VITE_` prefix used by Vite):

```bash
VITE_GOOGLE_CLIENT_ID=32341370449-g1757v5k948nrreul5ueonqf00c43m8o.apps.googleusercontent.com
```

Make sure the client ID is configured in the Google console with **all** the
front‑end origins you plan to use. At a minimum include
`http://localhost:8080` (or the hostname used during development) under
"Authorized JavaScript origins". Otherwise the popup will return a 403 error
stating that the origin is not allowed.

Note: after closing the Google login popup you may see a console message like
`Cross-Origin-Opener-Policy policy would block the window.closed call`. This
warning comes from the Google library and does not affect the login flow.

### Default entity token for public embeds

Some public pages (for example `/encuestas`) need to call the widget endpoints
with a valid tenant token. When the site is served outside of an embedded
widget there is no `window.CHATBOC_CONFIG` available, so set
`VITE_DEFAULT_ENTITY_TOKEN` in the frontend build to provide a fallback token.
The value is injected automatically in widget requests and cached in
`localStorage` when present.

```bash
VITE_DEFAULT_ENTITY_TOKEN=tu-token-publico
```

If the variable is not defined the requests will be sent without the header,
which typically results in `400` responses from `/public/encuestas`.

### Troubleshooting common console errors

When the API requests fail with messages like `Failed to load resource: the
server responded with a status of 403` or `Access to fetch has been blocked by
CORS policy`, verify that your `.env` file uses `VITE_API_URL=/api`. The Vite
proxy only works with this exact relative path; pointing `VITE_API_URL`
directly to `https://api.chatboc.ar` will bypass the proxy and trigger CORS
errors. The `apiFetch` helper now logs a warning about possible CORS issues if
`VITE_API_URL` is an absolute URL and a `TypeError: Failed to fetch` occurs.

If requests such as `GET /productos` return `404 Not Found`, ensure the local
API server from `server/app.js` is running on the same port referenced by
`VITE_API_URL`.

Some browser extensions (for example crypto wallets) inject scripts that modify
`window.ethereum` or `window.tronLink`. These scripts can log warnings such as
`Cannot assign to read only property 'ethereum' of object '#<Window>'` or
`This document requires 'TrustedScript' assignment`. They originate from the
extension itself and do not affect the application. Disable the extension if
the messages become distracting.

If the console shows `[GSI_LOGGER]: Provided button width is invalid: 100%`,
update the `width` prop in `src/components/auth/GoogleLoginButton.tsx` to a
numeric value like `width={300}`. The Google OAuth library does not accept
percentage values.

assets from your site. This results in an HTML error page being parsed as
JavaScript and the browser reports `Uncaught SyntaxError: Invalid or
unexpected token (window-provider.js:...)`. Always set the `data-domain`
attribute when self-hosting the script so the widget loads the correct files
from chatboc.ar. See the snippet above for the correct configuration.

When the server logs show messages such as `PERMISO DENEGADO` and the HTTP
response is `403`, the user lacks the required role for that endpoint. Check
the assigned role in the backend (via the admin panel or CLI) and ensure it is
`admin` or `empleado` (the backend may return role aliases like
`admin_municipio` or `empleado_pyme`, which the frontend normalizes). See
[docs/permission-denied.md](docs/permission-denied.md) for details.

## Animated logo

The `ChatbocLogoAnimated` component now supports two optional props:
`floating` and `pulsing`. When enabled, the logo gently floats up and down
or scales in and out to draw attention. These effects use Framer Motion and
can be combined with the existing `blinking` and `smiling` animations.

## User vs admin authentication

Final users sign up and log in through `/chatuserregisterpanel` and
`/chatuserloginpanel`. These endpoints associate the account with the
current business or municipality by reading the `X-Entity-Token` header and
also expect an `empresa_token` field in the JSON body.
Admins continue to use `/register` and `/login` for their panel. The
standalone pages `/user/register` and `/user/login` also mount these
user panels and are hidden from the global widget.

After logging in, the `rol` field returned by the backend decides where the
user is redirected. Admins and employees land on the full management panel
(`/perfil`), while regular users see the limited account page available at
`/cuenta`.

## Internal employee management

Regular chat users can only sign up as final customers. The frontend sends
their basic information to `/chatuserregisterpanel` and the backend assigns the
role. The registration form never exposes an option to mark an account as
`empleado`. Any employee accounts must be created from the administrator panel.
The page `/municipal/usuarios` relies on `useRequireRole(['admin'])` so only
admins can view or manage internal users. If a non-admin attempts to open that
section, the hook redirects back to the start page.

The `/municipal/usuarios` page now includes a small form to register employees.
Admins must provide name, email, password, role and a category fetched from the
backend. After creating the employee the list refreshes automatically.



## CRM clients endpoint

Administrators can list final users through `/crm/clientes`, which is also available at `/municipal/usuarios`. These endpoints accept two optional query parameters:

- `search` – text to match against the name or email
- `marketing=true` – return only users that consented to marketing messages

Without any parameters the full list of users is returned.

## Widget integration guidelines
Detailed requirements for the embedded widget can be found in [docs/widget-requirements.md](docs/widget-requirements.md).


## Municipal feature ideas
A list of potential enhancements for municipal deployments is available in [docs/municipal-features.md](docs/municipal-features.md).
Some of these ideas already have prototype pages under `/municipal/stats`, `/municipal/incidents`, `/municipal/tramites`, `/municipal/usuarios`, `/municipal/whatsapp`, `/municipal/integrations`, `/municipal/surveys` and `/notifications`.

The backend also exposes a professional analytics endpoint at `/municipal/analytics`. It provides advanced metrics such as ticket totals, categories and average response time for each municipality. This route lives alongside `/municipal/stats` and the other municipal pages listed above.

## Pyme feature ideas
See [docs/pyme-features.md](docs/pyme-features.md) for potential improvements.
A prototype catalog viewer is available under `/pyme/catalog`.
Business metrics for the demo are available at `/pyme/metrics`.

## Roles y perfiles
Más información en [docs/roles.md](docs/roles.md).

## Chatboc para gobiernos y opinar.ar
Para detalles sobre la oferta enfocada en municipios y la nueva empresa de encuestas, consultá [docs/opinar-ar.md](docs/opinar-ar.md).
