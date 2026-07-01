import asyncio
from playwright.async_api import async_playwright
import time
import os

async def verify_d4():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Monitor console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # Start local server
        os.system("python3 -m http.server 8000 > server.log 2>&1 &")
        time.sleep(2)

        try:
            await page.goto("http://localhost:8000")

            # Select D4
            await page.click('label:has-text("D4") span')

            # Roll dice
            await page.click('#rollBtn')

            # Wait for result
            result_selector = '#result.show'
            try:
                # Give it 45 seconds for D4 which might be bouncy
                await page.wait_for_selector(result_selector, timeout=45000)
                result_text = await page.inner_text('#result')
                print(f"D4 Result: {result_text}")

                # Take screenshot
                await page.screenshot(path="d4_refined_verification.png")
            except Exception as e:
                print(f"Error waiting for D4 result: {e}")
                await page.screenshot(path="d4_error_refined.png")

        finally:
            await browser.close()
            os.system("kill $(pgrep -f 'python3 -m http.server 8000')")

if __name__ == "__main__":
    asyncio.run(verify_d4())
