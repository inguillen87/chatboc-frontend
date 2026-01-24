import time
from playwright.sync_api import sync_playwright

def verify_order_tracking(page):
    # Mock API
    page.route("**/api/public/pyme/pedidos/DEMO-123", lambda route: route.fulfill(
        status=200,
        body="""{
            "nro_pedido": "DEMO-123",
            "pyme_nombre": "Tienda Demo",
            "estado": "confirmado",
            "monto_total": 1500,
            "fecha_creacion": "2023-10-27T10:00:00Z",
            "nombre_cliente": "Juan Perez",
            "direccion": "Calle Falsa 123",
            "telefono_cliente": "123456789",
            "detalles": [],
            "tenant_theme": {"primaryColor": "#ff00ff"},
            "tenant_logo": "https://via.placeholder.com/150"
        }""",
        headers={"content-type": "application/json"}
    ))

    page.goto("http://localhost:5173/pyme/pedidos/DEMO-123")

    # Wait for branding color to apply
    page.wait_for_selector("text=Tienda Demo")

    # Wait a bit for transitions
    time.sleep(1)

    page.screenshot(path="verification_order.png")
    print("Order Page verified.")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    try:
        verify_order_tracking(page)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()
