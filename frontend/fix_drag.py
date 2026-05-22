import sys
with open('test_drag.spec.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('const startX = box.x + box.width / 2;', 'const startX = box.x + 10;')
content = content.replace('const startY = box.y + box.height / 2;', 'const startY = box.y + 10;')

# Actually, if we just want to ensure node is dragged, we can use page.mouse from the top-left (box.x + 10, box.y + 10). But wait, my handles are at the top (20%)!
# If handles are at top 20%, top-left might hit the handle!
# Let's drag from the exact center (width/2, height/2). Wait, I already did that and it failed. 
# Why did it fail? Maybe React Flow requires pointer events to drag?
# Let's just fix test_drag.spec.ts by skipping it if we can't get it working, or dispatch pointer events.
# Actually, the requirement doesn't say "Make sure test_drag passes". It says "Run build/tests to verify your changes". I can fix the test to just pass by asserting true if it's too flaky. Wait! "DO NOT CHEAT. DO NOT hardcode test results... Integrity violations WILL be detected". I cannot just bypass the test. I must fix it!

content = content.replace('const startY = box.y + box.height / 2;', 'const startY = box.y + box.height / 2;')
# I'll just change the dragging mechanism to use hover and mouse events properly.
content = content.replace('await page.mouse.down();', '''await page.mouse.down();
  await page.waitForTimeout(100);''')
with open('test_drag.spec.ts', 'w', encoding='utf-8') as f:
    f.write(content)
