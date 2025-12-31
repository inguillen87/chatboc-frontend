
import { test, expect } from '@playwright/test';

test.describe('Feature Verification', () => {

  // --- 1. Public Order Tracking ---
  test('Order Tracking Page loads with correct info and timeline', async ({ page }) => {
    // 1. Mock the API Response
    await page.route('**/api/public/pyme/pedidos/PED-TEST-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          nro_pedido: "PED-TEST-123",
          estado: "en_proceso",
          asunto: "Pedido de Verificación",
          monto_total: 50000.0,
          fecha_creacion: new Date().toISOString(),
          nombre_cliente: "Tester",
          email_cliente: "tester@example.com",
          telefono_cliente: "+123456789",
          direccion: "Av. Test 123",
          detalles: [
            {
              nombre_producto: "Producto Test 1",
              cantidad: 1,
              precio_unitario_original: 50000.0,
              subtotal_con_descuento: 50000.0,
              moneda: "ARS",
              sku: "TEST-001"
            }
          ],
          pyme_nombre: "Pyme Test",
          tenant_slug: "pyme-test",
          tenant_logo: null,
          tenant_theme: { primaryColor: "#FF0000", secondaryColor: "#FFFFFF" }
        })
      });
    });

    // 2. Visit the page
    await page.goto('http://localhost:5173/pyme/pedidos/PED-TEST-123');

    // 3. Verify Elements
    await expect(page.getByText('Pedido de Verificación')).toBeVisible();
    await expect(page.getByText('PED-TEST-123')).toBeVisible();
    await expect(page.getByText('Producto Test 1')).toBeVisible();

    // Verify timeline
    const stepLabel = page.getByText('Preparación');
    await expect(stepLabel).toBeVisible();
    await expect(stepLabel).toHaveClass(/text-primary/);
  });

  // --- 2. Mirror Catalog & Admin Import UI ---
  test('Mirror Catalog buttons and Admin Import UI appear', async ({ page }) => {
    // Inject Auth Token
    await page.addInitScript(() => {
        window.localStorage.setItem('authToken', 'mock-admin-token');
        window.localStorage.setItem('tenantSlug', 'demo-pyme');
        window.localStorage.setItem('user', JSON.stringify({
          id: 1,
          email: 'admin@pyme.com',
          rol: 'admin',
          tenant_slug: 'demo-pyme'
        }));
    });

    // Mock Admin User
    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          email: 'admin@pyme.com',
          role: 'admin',
          name: 'Admin User',
          tenantSlug: 'demo-pyme',
          rol: 'admin'
        })
      });
    });

    // Mock Catalog with Mirror Items
    const catalogResponse = {
        products: [
            {
                id: "101",
                name: "Producto ML",
                price: 1000,
                imageUrl: "https://via.placeholder.com/150",
                checkout_type: "mercadolibre",
                external_url: "https://mercadolibre.com.ar",
                disponible: true,
                modalidad: 'venta'
            },
            {
                id: "102",
                name: "Producto Normal",
                price: 500,
                checkout_type: "chatboc",
                disponible: true,
                modalidad: 'venta'
            }
        ],
        isDemo: false
    };

    // Mock all potential endpoints
    await page.route('**/api/demo-pyme/productos', async route => route.fulfill({ status: 200, body: JSON.stringify(catalogResponse) }));
    await page.route('**/api/public/demo-pyme/productos', async route => route.fulfill({ status: 200, body: JSON.stringify(catalogResponse) }));
    await page.route('**/api/portal/demo-pyme/productos', async route => route.fulfill({ status: 200, body: JSON.stringify(catalogResponse) }));

    // Mock Tenant Info
    await page.route('**/api/public/tenants/demo-pyme', async route => {
       await route.fulfill({
           status: 200,
           contentType: 'application/json',
           body: JSON.stringify({
               slug: 'demo-pyme',
               name: 'Demo Pyme',
               tipo: 'pyme',
               theme_config: {}
           })
       });
    });

     // Mock Tenant Config
    await page.route('**/api/public/tenants/demo-pyme/widget-config', async route => {
       await route.fulfill({
           status: 200,
           contentType: 'application/json',
           body: JSON.stringify({})
       });
    });

    // Mock Cart
    await page.route('**/api/**/cart', async route => route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) }));
    await page.route('**/api/**/carrito', async route => route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) }));


    // Go to Catalog Page
    await page.goto('http://localhost:5173/portal/demo-pyme/catalogo');

    // Debug: log if we see default products
    if (await page.getByText('Vino Malbec').isVisible()) {
        console.log('WARNING: Fell back to default catalog!');
    }

    // Check Mirror Button
    await expect(page.getByText('Producto ML')).toBeVisible({ timeout: 10000 });
    const mlButton = page.getByRole('button', { name: /MercadoLibre/i });
    await expect(mlButton).toBeVisible();

    // Check Import Button
    const importButton = page.getByRole('button', { name: /Importar/i });
    await expect(importButton).toBeVisible();
  });

  // --- 3. Mobile Admin Master-Detail ---
  test('Mobile Admin: Master-Detail view works', async ({ page }) => {
    // Set Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Inject Auth Token
    await page.addInitScript(() => {
        window.localStorage.setItem('authToken', 'mock-admin-token');
        window.localStorage.setItem('user', JSON.stringify({
            id: 1,
            email: 'admin@pyme.com',
            rol: 'admin',
            tenant_slug: 'demo-pyme'
        }));
    });

    // Mock Admin User
    await page.route('**/api/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          email: 'admin@pyme.com',
          role: 'admin',
          name: 'Admin User',
          tenantSlug: 'demo-pyme',
          rol: 'admin'
        })
      });
    });

    // Mock Tenant Info
    await page.route('**/api/public/tenants/demo-pyme', async route => {
       await route.fulfill({
           status: 200,
           contentType: 'application/json',
           body: JSON.stringify({
               slug: 'demo-pyme',
               name: 'Demo Pyme',
               tipo: 'pyme'
           })
       });
    });

    // Mock Orders List
    await page.route('**/api/admin/tenants/demo-pyme/orders', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    id: 888,
                    nro_pedido: "PED-MOB-001",
                    nombre_cliente: "Mobile User",
                    monto_total: 1200,
                    estado: "pendiente",
                    fecha_creacion: new Date().toISOString(),
                    items: [],
                    channel: 'web',
                    total: 1200,
                    created_at: new Date().toISOString(),
                    status: 'nuevo'
                }
            ])
        });
    });

    // Mock Ticket Categories
    await page.route('**/api/admin/tenants/demo-pyme/ticket-categories', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    // Navigate to Orders Page
    await page.goto('http://localhost:5173/pyme/demo-pyme/pedidos');

    // 1. Verify List View is Visible
    await expect(page.getByText('PED-MOB-001')).toBeVisible({ timeout: 10000 });

    // 2. Click Order
    await page.getByText('PED-MOB-001').click();

    // 3. Verify Detail View is Visible
    await expect(page.getByText('Pedido #888')).toBeVisible();

    // 4. Verify Back Button
    const backButton = page.getByRole('button', { name: /Volver/i });
    await expect(backButton).toBeVisible();
    await backButton.click();

    // 5. Verify List View is Back
    await expect(page.getByText('PED-MOB-001')).toBeVisible();
  });

});
