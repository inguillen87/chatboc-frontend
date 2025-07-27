# How to Embed the Chat Widget

To embed the chat widget on your website, you need to add the following script tag to your HTML file, preferably before the closing `</body>` tag.

## Basic Implementation

```html
<script src="https://www.chatboc.ar/widget.js" data-token="YOUR_UNIQUE_TOKEN"></script>
```

Replace `YOUR_UNIQUE_TOKEN` with the token provided for your account.

## How It Works

The `widget.js` script creates an isolated `<iframe>` on your page to ensure there are no style or script conflicts with your website. The widget is displayed as a floating button. When a user clicks this button, the chat panel opens.

The new implementation is more efficient, with all animations and logic handled inside the iframe for a smoother experience.

## Customization Attributes

You can customize the widget's appearance and behavior by adding `data-*` attributes to the script tag:

*   `data-token` (Required): Your unique widget identifier.
*   `data-domain`: The domain where the widget assets are hosted. Defaults to `https://www.chatboc.ar`. Only change this for self-hosted installations.
*   `data-bottom`: The distance from the bottom of the screen (e.g., "30px"). Defaults to "20px".
*   `data-right`: The distance from the right of the screen (e.g., "30px"). Defaults to "20px".
*   `data-default-open`: Set to `"true"` to have the widget open by default.
*   `data-cta-message`: A short message that appears in a bubble next to the closed widget to encourage interaction (e.g., "Need help?").
*   `data-rubro`: A specific category or department to associate the chat with from the beginning.

### Example with Customizations

```html
<script
  src="https://www.chatboc.ar/widget.js"
  data-token="YOUR_UNIQUE_TOKEN"
  data-bottom="40px"
  data-right="40px"
  data-cta-message="¡Hola! ¿Necesitas ayuda?"
></script>
```

## JavaScript API

You can programmatically control the widget using the global `window.Chatboc` object.

*   `Chatboc.open()`: Opens the chat panel.
*   `Chatboc.close()`: Closes the chat panel.
*   `Chatboc.toggle()`: Toggles the chat panel's visibility.
*   `Chatboc.setView(viewName)`: Opens the widget to a specific view. `viewName` can be `'chat'`, `'login'`, or `'register'`.

### API Usage Example

```html
<button onclick="Chatboc.open()">Open Chat</button>
<button onclick="Chatboc.setView('login')">Login</button>
```
