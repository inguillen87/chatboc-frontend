# Jules Task Summary

## Jules Backend Tasks

Please implement the following robust backend features to support the new unified commerce flows.

### 1. Order Automation (Critical)
- **Goal:** Ensure every order (Web, Chat, Voice) is persisted and triggers fulfillment flows.
- **Requirement:**
  - Create a `PymePedido` entity immediately upon order confirmation.
  - Ensure `tenant_id` is correctly associated (already fixed for voice, verify for chat/web).
  - **Idempotency:** Prevent duplicate orders if the user double-clicks "Confirm".

### 2. Notification System (Omnichannel)
- **Trigger:** `OrderCreated` event.
- **Actions:**
  1.  **Customer Chat/WhatsApp:** Send a confirmation message ("Tu pedido #123 fue recibido...").
  2.  **Customer Email:** Send a receipt using a branded HTML template (include logo, colors, item list).
  3.  **Dispatch Email (Depósito):** Send a "Pick List" email to `tenant.dispatch_email` (or `notification_settings.dispatch_email`).
  4.  **Dispatch WhatsApp:** Send a summary alert to `tenant.dispatch_phone`.

### 3. Tenant Configuration Endpoints
- **Update:** Extend `PUT /api/admin/tenants/:slug` or `PUT /api/admin/tenants/:slug/notifications` to accept:
  - `dispatch_email`
  - `dispatch_phone`
  - `theme_config` (JSON for storing brand colors/logos if not in main table).

### 4. Integration Webhooks (DrakkarPress Pattern)
- **MercadoLibre / TiendaNube / Shopify:**
  - **Product Sync:** When a product changes in the external platform, update the local `PymeProducto`.
  - **Order Webhook:** When an order occurs externally, create a local `PymePedido` to keep inventory and analytics unified.
  - **Error Handling:** Return clear 4xx/5xx codes with descriptive messages (e.g., "Plan Limit Reached") so the frontend can show friendly toasts.

---

## Jules Frontend Tasks (Status Report)

The following UI/UX improvements have been implemented. Please review for consistency.

### 1. Chat Customization & Preview (Done)
- **Component:** `ChatCustomizer` in `IntegracionesPage`.
- **Features:** Live preview of the widget with adjustable Primary/Accent colors, Bot Name, and Logo.
- **Preview:** The `WidgetPreview` now renders a "true-to-life" interactive chat bubble.

### 2. Catalog Import Wizard (Done)
- **Component:** `CatalogUploadWizard`.
- **Features:**
  - 3-Step Flow: Upload (Excel/CSV) -> Mapping -> Visual Preview -> Confirm.
  - **Visual Preview:** Displays a mock "Product Card" showing exactly how the imported data will look to customers.

### 3. Order Tracking Branding (Verified)
- **Page:** `/pyme/pedidos/:nro_pedido` (`OrderTrackingPage`).
- **Status:** Confirmed it dynamically fetches `tenant_theme` from the API and applies the brand's Primary Color and Logo to the interface.

### 4. Dispatch Settings (Done)
- **Component:** `OrderDispatchSettings`.
- **Features:** Simple UI to configure the "Depósito Email" and "Logistics WhatsApp".

### 5. Pending UX/UI Audit (To Do)
- **Consistency:** Ensure all "Save" buttons use the same loading state and icon pattern.
- **Mobile:** Verify the new "Tabs" layout in `IntegracionesPage` behaves well on mobile (scrollable tabs).
- **Error Toasts:** Ensure `apiClient` global error handling maps 403/503 responses to the friendly messages requested ("Plataforma no configurada").
