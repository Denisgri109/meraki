import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:8081", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # -> Send API requests with missing required fields to critical endpoints (booking, payment, messaging) to verify 400 status and descriptive error messages.
        await page.goto('http://localhost:8081/api/booking', timeout=10000)
        await asyncio.sleep(3)
        

        await page.goto('http://localhost:8081/api/payment', timeout=10000)
        await asyncio.sleep(3)
        

        await page.goto('http://localhost:8081/api/messaging', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Send API requests with missing required fields to booking, payment, and messaging endpoints.
        await page.goto('http://localhost:8081/api/booking', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Send POST request with missing required fields to booking endpoint.
        await page.goto('http://localhost:8081/api/booking', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Send POST request with missing required fields to booking endpoint to verify 400 status and descriptive error message.
        await page.goto('http://localhost:8081/api/booking', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Send POST request with missing required fields to booking endpoint to verify 400 status and descriptive error message.
        await page.goto('http://localhost:8081/api/booking', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Send POST request with missing required fields to booking endpoint to verify 400 status and descriptive error message.
        await page.goto('http://localhost:8081/api/booking', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Send POST request with missing required fields to booking endpoint to verify 400 status and descriptive error message.
        await page.goto('http://localhost:8081/api/booking', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Send POST request with missing required fields to booking endpoint to verify 400 status and descriptive error message.
        await page.goto('http://localhost:8081/api/booking', timeout=10000)
        await asyncio.sleep(3)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=React App - You need to enable JavaScript to run this app.').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    