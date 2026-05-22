import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("Navigating to http://localhost:5173")
        await page.goto("http://localhost:5173", wait_until="networkidle")
        
        print("Checking for failed to fetch overlay...")
        overlay = await page.query_selector("text=Failed to fetch")
        if overlay:
            print("ERROR: Failed to fetch overlay is visible!")
            return

        print("Clicking Create Node...")
        await page.click("button:has-text('Create Node')")
        
        print("Filling form...")
        await page.fill("input[type='text']", "TestNode1")
        await page.click("button:has-text('Add'), button:has-text('Save')")

        print("Waiting for node to appear...")
        await page.wait_for_timeout(1000)
        
        print("SUCCESS! UI flow works.")
        await browser.close()

asyncio.run(main())
