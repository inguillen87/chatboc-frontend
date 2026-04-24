# Jules Task Summary

## Jules Backend Tasks

Please implement the following robust backend features to support the new unified commerce flows.

### 1. Order Automation & Persistence
- **Goal:** Ensure every order (Web, Chat, Voice) is persisted and triggers fulfillment flows.
- **Requirement:**
  - Create a `PymePedido` entity immediately upon order confirmation.
  - **Idempotency:** Prevent duplicate orders if the user double-clicks "Confirm". Implement an idempotent key mechanism (e.g., using a hash of the cart + timestamp + user ID).
  - Ensure `tenant_id` is correctly associated in all scenarios (Voice, Chat, Web).

### 2. Notification System (Omnichannel)
- **Trigger:** `OrderCreated` event.
- **Actions:**
  1.  **Customer Chat/WhatsApp:** Send a confirmation message ("Tu pedido #123 fue recibido...").
  2.  **Customer Email:** Send a receipt using a branded HTML template (include logo, colors, item list).
  3.  **Dispatch Email (Depósito):** Send a "Pick List" email to the configured `dispatch_email` (or `notification_settings.dispatch_email`). This email should be formatted for warehouse staff (clear quantities, SKUs, customer shipping info).
  4.  **Dispatch WhatsApp:** Send a summary alert to `dispatch_phone` if configured.

### 3. Tenant Configuration Endpoints
- **Update:** Extend `PUT /api/admin/tenants/:slug` or `PUT /api/admin/tenants/:slug/notifications` to accept:
  - `dispatch_email`
  - `dispatch_phone`
  - `theme_config` (JSON for storing brand colors/logos if not in main table).

### 4. Integration Webhooks (DrakkarPress Pattern)
- **MercadoLibre / TiendaNube / Shopify:**
  - **Product Sync:** When a product changes in the external platform, update the local `PymeProducto`.
  - **Order Webhook:** When an order occurs externally, receive the webhook and create a local `PymePedido`. This ensures the Admin Dashboard is the "Single Source of Truth" for inventory and sales.
  - **Error Handling:** Return clear 4xx/5xx codes with descriptive messages (e.g., "Plan Limit Reached", "Account Not Linked") so the frontend can display friendly toasts instead of generic errors.

---

## Jules Frontend Tasks (Status Report)

The following UI/UX improvements have been implemented. Please review for consistency.

### 1. Chat Customization & Preview (Done)
- **Component:** `ChatCustomizer` in `IntegracionesPage`.
- **Features:** Live preview of the widget with adjustable Primary/Accent colors, Bot Name, Logo, **Animation Style**, and **Font Family**.
- **Preview:** The `WidgetPreview` now renders a "true-to-life" interactive chat bubble that respects the selected animation and colors.

### 2. Catalog Import & Mapping (Done)
- **Component:** `CatalogUploadWizard`.
- **Mapping Dialog:** Enhanced the Integration Mapping dialog (`IntegracionesPage`) to include a "Preview Products" tab.
- **Visuals:** Both wizards now show a "Product Card" preview (Before/After) so users can verify how titles, prices, and images will appear in their catalog *before* syncing.

### 3. Order Tracking Branding (Verified)
- **Page:** `/pyme/pedidos/:nro_pedido` (`OrderTrackingPage`).
- **Status:** Confirmed it dynamically fetches `tenant_theme` from the API and applies the brand's Primary Color and Logo to the interface.

### 4. Dispatch Settings (Done)
- **Component:** `OrderDispatchSettings`.
- **Features:** Simple UI to configure the "Depósito Email" and "Logistics WhatsApp".

### 5. UX/UI Consistency (Ongoing)
- **Status:** Standardized on ShadCN components.
- **Pending:** Conduct a full mobile responsiveness audit on the new "Tabs" layouts in `IntegracionesPage`.
