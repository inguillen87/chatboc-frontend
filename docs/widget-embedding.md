# How to Embed the Chat Widget

To embed the chat widget on your website, you need to add the following script tag to your HTML file, just before the closing `</body>` tag:

```html
<script src="http://localhost:3001/widget.js"></script>
```

## Customization

You can customize the chat widget by adding the following attributes to the script tag:

*   `data-primary-color`: The primary color of the widget (in hex format).
*   `data-logo-url`: The URL of the logo to display in the widget launcher.
*   `data-position`: The position of the widget on the screen ('left' or 'right').

Example:

```html
<script
  src="http://localhost:3001/widget.js"
  data-primary-color="#ff0000"
  data-logo-url="https://example.com/logo.png"
  data-position="left"
></script>
```

## How it works

The `widget.js` script will create an iframe on your page and load the chat widget into it. The widget will be displayed as a floating button on the bottom right corner of the screen (or bottom left, if you set the `data-position` attribute to 'left'). When the user clicks on the button, the chat panel will open.

The script will also automatically pass the user's information to the widget, if the user is logged in to your website. This will allow the widget to display the user's name and contact information in the chat.
