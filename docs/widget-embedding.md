# How to Embed the Chat Widget

Include the auth helper to mint and refresh tokens automatically:

```html
<script async src="https://cdn.chatboc.ar/widget.js"
        data-api-base="https://api.chatboc.ar"
        data-owner-token="OWNER_TOKEN_DE_LA_ENTIDAD"></script>
```

The script above both mints and refreshes tokens automatically and mounts the chat widget.

## Customization

You can customize the chat widget by adding the following attributes to the script tag:

*   `data-primary-color`: Background color of the closed launcher (any CSS color).
*   `data-logo-url`: URL of the image shown inside the launcher.
*   `data-logo-animation`: CSS animation to apply to the launcher image (e.g., `bounce 2s infinite`).
*   `data-bottom` / `data-right`: Offsets (e.g., `24px`) to tweak widget position.
*   `data-lang`: ISO language code (for example, `es` or `en`) used to request localized widget content.

Example:

```html
<script
  src="https://cdn.chatboc.ar/widget.js"
  data-primary-color="#ff0000"
  data-logo-url="https://example.com/logo.png"
  data-logo-animation="bounce 2s infinite"
  data-lang="es"
></script>
```

## How it works

The `widget.js` script creates an iframe on your page and displays a floating button on the bottom right corner of the screen. You can tweak its offset with `data-bottom` and `data-right`. When the user clicks on the button, the chat panel opens.

If the user is logged in to your website, the script passes that information to the widget so the chat can display their name and contact details.
