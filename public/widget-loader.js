/**
 * Chatboc Widget Loader
 * Copy and paste this script into your website to embed the Chatboc widget.
 * Usage:
 * <script>
 *   window.chatbocSettings = { tenant: 'your-tenant-slug' };
 *   (function(d, s, id) { ... })(document, 'script', 'chatboc-js');
 * </script>
 */

(function (window, document) {
  'use strict';

  // Configuration
  var settings = window.chatbocSettings || {};
  var tenantSlug = settings.tenant;
  var baseUrl = settings.baseUrl || 'https://app.chatboc.com'; // Adjust for production

  if (!tenantSlug) {
    console.warn('Chatboc: No tenant slug provided.');
    return;
  }

  // Create Iframe
  var iframe = document.createElement('iframe');
  iframe.id = 'chatboc-widget-frame';
  iframe.src = baseUrl + '/iframe?tenant=' + encodeURIComponent(tenantSlug);

  // Styles
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px';
  iframe.style.right = '20px';
  iframe.style.width = '60px'; // Initial button size
  iframe.style.height = '60px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '30px'; // Circular initially
  iframe.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  iframe.style.zIndex = '999999';
  iframe.style.transition = 'width 0.3s ease, height 0.3s ease, border-radius 0.3s ease';
  iframe.style.overflow = 'hidden';

  document.body.appendChild(iframe);

  // Communication (PostMessage)
  window.addEventListener('message', function(event) {
    // Security check: ensure origin matches (if needed)
    // Normalize origin check
    var allowedOrigin = new URL(baseUrl).origin;
    if (event.origin !== allowedOrigin) return;

    var data = event.data;
    if (!data) return;

    if (data.type === 'CHATBOC_RESIZE') {
      if (data.isOpen) {
        // Expanded state
        if (window.innerWidth < 640) {
          // Mobile: Fullscreen
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.bottom = '0';
          iframe.style.right = '0';
          iframe.style.borderRadius = '0';
        } else {
          // Desktop: Popover
          iframe.style.width = '400px';
          iframe.style.height = '600px';
          iframe.style.borderRadius = '12px';
        }
      } else {
        // Collapsed state (Button only)
        iframe.style.width = '60px';
        iframe.style.height = '60px';
        iframe.style.bottom = '20px';
        iframe.style.right = '20px';
        iframe.style.borderRadius = '30px';
      }
    }
  });

})(window, document);
