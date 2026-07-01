import asyncio
from playwright.async_api import async_playwright
import time
import os
import sys

async def verify_dice():
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

            # 1. Verify D4
            print("Verifying D4...")
            await page.click('label:has-text("D4") span')
            await page.click('#rollBtn')

            try:
                await page.wait_for_selector('#result.show', timeout=60000)
                result_text = await page.inner_text('#result')
                print(f"D4 Result: {result_text}")
                await page.screenshot(path="regression_d4.png")
            except Exception as e:
                print(f"FAILED D4: {e}")
                await page.screenshot(path="error_d4.png")

            # 2. Verify D10
            print("Verifying D10...")
            await page.click('label:has-text("D10") span')

            # Perform a few rolls to increase chance of seeing 1-5
            for i in range(3):
                await page.click('#rollBtn')
                try:
                    await page.wait_for_selector('#result.show', timeout=60000)
                    result_text = await page.inner_text('#result')
                    print(f"D10 Roll {i+1} Result: {result_text}")
                    await page.screenshot(path=f"regression_d10_{i+1}.png")
                    # Wait for result to hide before next roll
                    await page.wait_for_selector('#result.show', state="hidden", timeout=10000)
                except Exception as e:
                    print(f"FAILED D10 Roll {i+1}: {e}")
                    await page.screenshot(path=f"error_d10_{i+1}.png")

            print("Verification complete. Check screenshots regression_d4.png and regression_d10_*.png")

        finally:
            await browser.close()
            os.system("kill $(pgrep -f 'python3 -m http.server 8000')")

if __name__ == "__main__":
    asyncio.run(verify_dice())
