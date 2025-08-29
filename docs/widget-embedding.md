# How to Embed the Chat Widget

To embed the chat widget on your website, you need to add the following script tag to your HTML file, just before the closing `</body>` tag:

```html
<script src="http://localhost:3001/widget.js"></script>
```

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
  src="http://localhost:3001/widget.js"
  data-primary-color="#ff0000"
  data-logo-url="https://example.com/logo.png"
  data-logo-animation="bounce 2s infinite"
  data-lang="es"
></script>
```

## How it works

The `widget.js` script creates an iframe on your page and displays a floating button on the bottom right corner of the screen. You can tweak its offset with `data-bottom` and `data-right`. When the user clicks on the button, the chat panel opens.

If the user is logged in to your website, the script passes that information to the widget so the chat can display their name and contact details.
