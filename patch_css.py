import sys
path = 'frontend/src/index.css'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''.react-flow__node.de-emphasized,
.react-flow__edge.de-emphasized {
  opacity: 0.2;
}'''

replacement = '''.has-selection .react-flow__node:not(.active),
.has-selection .react-flow__edge:not(.active) {
  opacity: 0.2;
}'''

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced successfully.")
else:
    print("Target not found.")

