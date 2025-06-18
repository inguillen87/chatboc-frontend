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

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/a97ee1e3-5a88-429f-8969-dcd039ee2482) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Embedding the Chatboc widget

You can embed the floating chat widget on any site by loading `widget.js` and passing your token. Example:

```html
<script>
  (function () {
    var s = document.createElement('script');
    s.src = 'https://www.chatboc.ar/widget.js';
    s.async = true;
    s.setAttribute('data-token', 'TU_TOKEN_AQUI');
    // Optional: force light or dark theme
    // s.setAttribute('data-theme', 'dark');
    document.head.appendChild(s);
  })();
</script>
```

This snippet loads the widget without needing an iframe and creates a floating bubble styled just like on chatboc.ar.
You can also pass `data-theme="dark"` or `data-theme="light"` to force a specific theme inside the widget.

### Customization

The `<script>` tag accepts several extra `data-*` attributes to control the widget's look:

- `data-bottom` and `data-right` – offset from the bottom-right corner (`20px` by default).
- `data-default-open="true"` – open the chat automatically when the page loads.
- `data-width` / `data-height` – size of the open chat window (defaults to `370px` × `540px`).
- `data-closed-width` / `data-closed-height` – size of the closed bubble (`88px` × `88px`).
- `data-z` – base `z-index` if you need to adjust stacking order.
- `data-domain` – custom domain hosting the widget, if different from `chatboc.ar`.

### Iframe fallback

If your site blocks external JavaScript, you can embed the chatbot using an
`<iframe>` instead. Replace `TU_TOKEN_AQUI` with your token:

```html
<iframe
  id="chatboc-iframe"
  src="https://www.chatboc.ar/iframe?token=TU_TOKEN_AQUI"
  style="position:fixed;bottom:24px;right:24px;border:none;border-radius:50%;z-index:9999;box-shadow:0 4px 32px rgba(0,0,0,0.2);background:transparent;overflow:hidden;width:88px!important;height:88px!important;display:block"
  allow="clipboard-write"
  loading="lazy"
></iframe>
<script>
  (function () {
    var f = document.getElementById('chatboc-iframe');
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'chatboc-resize') {
        f.style.width = e.data.dimensions.width;
        f.style.height = e.data.dimensions.height;
        f.style.borderRadius = e.data.isOpen ? '16px' : '50%';
      }
    });
  })();
</script>
```

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

## Product catalog API

Any endpoint that returns products (e.g. `/catalogo`, `/productos`, `/ask`)
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
