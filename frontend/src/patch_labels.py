import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<label>Max Depth</label>',
    '<label htmlFor="max-depth-input">Max Depth</label>'
)
content = content.replace(
    '<input type="number" min="1" max="10"',
    '<input id="max-depth-input" type="number" min="1" max="10"'
)

content = content.replace(
    '<label>Node Category:</label><input type="text"',
    '<label htmlFor="node-category-input">Node Category:</label><input id="node-category-input" type="text"'
)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
