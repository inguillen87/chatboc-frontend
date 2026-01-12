# How to Embed the Chat Widget

Include the widget script to mint and refresh tokens automatically:

```html
<script async src="https://chatboc.ar/widget.js"
        data-api-base="https://chatboc.ar"
        data-owner-token="OWNER_TOKEN_DE_LA_ENTIDAD"
        data-primary-color="#007aff"
        data-accent-color="#ff6600"
        data-logo-url="https://example.com/logo.png"
        data-header-logo-url="https://example.com/header.png"
        data-logo-animation="bounce 2s infinite"
        data-welcome-title="Hola"
        data-welcome-subtitle="¿En qué podemos ayudarte?"
        data-shadow-dom="true"
        data-bottom="20px"
        data-right="20px"
        data-width="460px"
        data-height="680px"
        data-closed-width="112px"
        data-closed-height="112px"
        data-endpoint="pyme"></script>
```

The script above mints and refreshes tokens automatically and mounts the chat widget.

## Customization

You can customize the chat widget by adding the following attributes to the script tag:

* `data-api-base`: Base URL for API calls.
* `data-owner-token`: Owner token for minting.
* `data-primary-color`, `data-accent-color`: Colors for launcher and accents.
* `data-logo-url`, `data-header-logo-url`: URLs for launcher and header logos.
* `data-logo-animation`: CSS animation for the launcher image.
* `data-welcome-title`, `data-welcome-subtitle`: Texts displayed on the welcome screen.
* `data-shadow-dom`: Set to `true` to isolate widget styles from host pages.
* `data-bottom`, `data-right`: Offsets to tweak widget position.
* `data-width`, `data-height`: Open widget size.
* `data-closed-width`, `data-closed-height`: Closed launcher size.
* `data-endpoint`: `pyme` or `municipio`.

If you embed this snippet inside another `<iframe>`, ensure that container iframe includes:

```html
allow="clipboard-write; geolocation; microphone; camera"
```
to grant the widget the necessary permissions.

## How it works

The `widget.js` script creates an iframe on your page and displays a floating button on the bottom right corner of the screen. You can tweak its offset with `data-bottom` and `data-right`. When the user clicks on the button, the chat panel opens.

If the user is logged in to your website, the script passes that information to the widget so the chat can display their name and contact details.
