import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<label>Label:</label>',
    '<label htmlFor="label-input">Label:</label>'
)
content = content.replace(
    '<input type="text" value={editFormData.label || \'\'}',
    '<input id="label-input" type="text" value={editFormData.label || \'\'}'
)
content = content.replace(
    '<input type="text" value={editFormData.label || ""}',
    '<input id="label-input" type="text" value={editFormData.label || ""}'
)
# Note: App.tsx might use single or double quotes

content = content.replace(
    '<label>Name:</label>',
    '<label htmlFor="name-input">Name:</label>'
)
content = content.replace(
    '<input type="text" value={editFormData.name || \'\'}',
    '<input id="name-input" type="text" value={editFormData.name || \'\'}'
)
content = content.replace(
    '<input type="text" value={editFormData.name || ""}',
    '<input id="name-input" type="text" value={editFormData.name || ""}'
)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
