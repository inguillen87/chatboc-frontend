import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Listen for console events correctly
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # 1. Navigate to the local test page
        file_path = os.path.abspath("jules-scratch/verification/test.html")
        await page.goto(f"file://{file_path}")

        # Wait for the widget to load and potentially fetch profile info
        await page.wait_for_timeout(5000)

        # 2. Open the chat widget
        chat_frame_locator = page.frame_locator('iframe[src*="iframe?"]')

        open_button = chat_frame_locator.get_by_role("button").first
        await expect(open_button).to_be_visible(timeout=15000)
        await open_button.click()

        await page.wait_for_timeout(3000)

        # 3. Send a message by clicking a predefined button
        reclamo_button = chat_frame_locator.get_by_role("button", name="Hacer un Reclamo")
        await expect(reclamo_button).to_be_visible(timeout=15000) # Increased timeout
        await reclamo_button.click()

        # 4. Wait for the bot's response
        response_text = "Por supuesto. ¿Sobre qué tema es tu reclamo? Seleccioná una opción:"
        response_locator = chat_frame_locator.get_by_text(response_text, exact=True)

        await expect(response_locator).to_be_visible(timeout=20000)

        luminaria_button = chat_frame_locator.get_by_role("button", name="💡 Luminaria")
        await expect(luminaria_button).to_be_visible(timeout=10000)

        # 5. Take a screenshot
        await page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken successfully.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
