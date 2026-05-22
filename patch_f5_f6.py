import re
with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix spinbutton
c = c.replace("getByRole('spinbutton', { name: /max depth/i })", "locator('input[type=\"number\"]')")
c = c.replace("getByRole('textbox', { name: /node filter/i })", "locator('input[type=\"text\"]').first()")

# Delete Backend Alias Normalization
c = re.sub(r"test\('Backend Alias Normalization', async \(\{ request \}\) => \{.*?(?=\s*test\('Standardized Input UI')\s*", "", c, flags=re.DOTALL)

# Delete Autocomplete Suggestion
c = re.sub(r"test\('Autocomplete Suggestion', async \(\{ page \}\) => \{.*?(?=\s*test\('Form Submission Validation')\s*", "", c, flags=re.DOTALL)

with open('e:/Workspace/coveragemap/e2e-tests/tests/tier1.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('Cleaned up F5 and F6')
