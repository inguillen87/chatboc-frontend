import asyncio
import re
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        try:
            # Navigate to the test page that hosts the widget
            await page.goto("http://localhost:5173/test-widget.html?token=demo-anon", timeout=60000)

            # Get the iframe
            iframe = page.frame_locator("iframe[title='Chatboc Widget']")

            # Click the button to open the chat
            open_chat_button = iframe.get_by_role("button", name="Abrir chat")
            await expect(open_chat_button).to_be_visible(timeout=10000)
            await open_chat_button.click()

            # 1. Verify the menu appears automatically
            menu_button = iframe.get_by_role("button", name="Hacer un Reclamo")
            await expect(menu_button).to_be_visible(timeout=15000)
            print("Verification PASSED: Menu is visible.")

            # 2. Verify the welcome message is correct
            # Find the first message bubble from the bot
            first_bot_message = iframe.locator(".chat-bubble-bot").first
            await expect(first_bot_message).to_be_visible()

            # Check that the text does NOT contain "Usuario de WhatsApp"
            text_content = await first_bot_message.text_content()
            if "Usuario de WhatsApp" in text_content:
                raise Exception("Verification FAILED: Welcome message contains 'Usuario de WhatsApp'")

            # Check that the text DOES contain "¡Hola!"
            await expect(first_bot_message).to_contain_text("¡Hola!")

            print("Verification PASSED: Welcome message is generic.")

            # Take a screenshot for final visual confirmation
            widget_container = page.locator("#chatboc-widget-container")
            screenshot_path = "jules-scratch/verification/widget_final.png"
            await widget_container.screenshot(path=screenshot_path)

            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="jules-scratch/verification/error_widget_final.png")
            print("Saved error screenshot to jules-scratch/verification/error_widget_final.png")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
