import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        try:
            # Navigate to the test page that hosts the widget
            # The test page requires a 'token' URL parameter to load the widget script.
            await page.goto("http://localhost:5173/test-widget.html?token=demo-anon", timeout=60000)

            # The widget creates a shadow DOM, but Playwright can pierce it.
            # The iframe is inside the shadow DOM of the container.
            # Let's locate the iframe directly. Playwright's locators handle this.
            iframe = page.frame_locator("iframe[title='Chatboc Widget']")

            # Find the button to open the chat inside the iframe
            open_chat_button = iframe.get_by_role("button", name="Abrir chat")
            await expect(open_chat_button).to_be_visible(timeout=10000)
            await open_chat_button.click()

            # After clicking, the menu should appear inside the iframe.
            # Let's wait for one of the menu buttons to be visible.
            menu_button = iframe.get_by_role("button", name="Hacer un Reclamo")
            await expect(menu_button).to_be_visible(timeout=15000) # Give it extra time for the backend to respond

            # Take a screenshot of the widget area for verification
            # We can screenshot the iframe's parent container
            widget_container = page.locator("#chatboc-widget-container")
            screenshot_path = "jules-scratch/verification/widget_menu.png"
            await widget_container.screenshot(path=screenshot_path)

            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="jules-scratch/verification/error_widget_menu.png")
            print("Saved error screenshot to jules-scratch/verification/error_widget_menu.png")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
