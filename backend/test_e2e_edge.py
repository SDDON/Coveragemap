import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.on("pageerror", lambda err: print(f"Browser error: {err}"))
        
        print("Navigating to http://localhost:5173")
        await page.goto("http://localhost:5173", wait_until="networkidle")
        
        print("Clicking Create Node 1...")
        await page.click("button:has-text('Create Node')")
        await page.fill("input[type='text']", "TestNode1")
        await page.click("button:has-text('Save'), button:has-text('Add')")

        print("Clicking Create Node 2...")
        await page.click("button:has-text('Create Node')")
        await page.fill("input[type='text']", "TestNode2")
        await page.click("button:has-text('Save'), button:has-text('Add')")

        await page.wait_for_timeout(1000)

        # Connect them using React Flow
        # Since simulating drag and drop on SVG paths in playwright is hard, 
        # let's find the source handle and target handle.
        # Nodes have data-id. We can find the handles inside them.
        print("Connecting Node 1 and Node 2...")
        
        source = await page.wait_for_selector(".react-flow__node:has-text('TestNode1') .react-flow__handle-right, .react-flow__node:has-text('TestNode1') .source")
        target = await page.wait_for_selector(".react-flow__node:has-text('TestNode2') .react-flow__handle-left, .react-flow__node:has-text('TestNode2') .target")
        
        if source and target:
            # Playwright drag and drop doesn't always work perfectly for React flow, but we can try mouse movements
            src_box = await source.bounding_box()
            tgt_box = await target.bounding_box()
            
            await page.mouse.move(src_box["x"] + src_box["width"] / 2, src_box["y"] + src_box["height"] / 2)
            await page.mouse.down()
            await page.mouse.move(tgt_box["x"] + tgt_box["width"] / 2, tgt_box["y"] + tgt_box["height"] / 2, steps=10)
            await page.mouse.up()
            
            await page.wait_for_timeout(1000)
            print("Edge should be created.")
            edges = await page.query_selector_all(".react-flow__edge")
            if len(edges) > 0:
                print("SUCCESS! UI flow works including edges.")
            else:
                print("ERROR: No edge found!")
        else:
            print("ERROR: Could not find source or target handles.")
            
        await browser.close()

asyncio.run(main())
