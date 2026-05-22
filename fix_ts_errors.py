import re

with open("e:/Workspace/coveragemap/frontend/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Move undo hook
undo_hook_regex = re.compile(r"(\s*// Undo Stack\s*const actionHistory = useRef.*?\s*\}, \[handleUndo\]\);\s*)", re.DOTALL)
match = undo_hook_regex.search(content)
if match:
    undo_hook_code = match.group(1)
    content = content.replace(undo_hook_code, "")
    
    # insert after const triggerRefresh
    insert_pos = content.find("const triggerRefresh = () => setRefreshKey(k => k + 1);")
    if insert_pos != -1:
        insert_pos += len("const triggerRefresh = () => setRefreshKey(k => k + 1);")
        content = content[:insert_pos] + "\n" + undo_hook_code + content[insert_pos:]

# 2. Fix line 395 and 418 TS errors (now line numbers might have shifted, but we can do string replace)
content = content.replace(
    "{ ...e.markerEnd, color: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') }",
    "{ type: 'arrowclosed', color: newStatus === 'Passed' ? 'green' : (newStatus === 'Failed' ? 'red' : 'gray') }"
)
content = content.replace(
    "{ ...n.style, backgroundColor:",
    "{ ...(n.style || {}), backgroundColor:"
)
content = content.replace(
    "{ ...e.style, stroke:",
    "{ ...(e.style || {}), stroke:"
)
content = content.replace(
    "{ ...n.data, test_status: newStatus }",
    "{ ...(n.data || {}), test_status: newStatus }"
)
content = content.replace(
    "{ ...e.data, test_status: newStatus }",
    "{ ...(e.data || {}), test_status: newStatus }"
)

# 3. Fix toLowerCase TS error
content = content.replace(
    "cls += ' status-' + (n.data.test_status || 'untested').toLowerCase();",
    "cls += ' status-' + ((n.data as any).test_status || 'untested').toLowerCase();"
)
content = content.replace(
    "cls += ' status-' + (e.data?.test_status || 'untested').toLowerCase();",
    "cls += ' status-' + ((e.data as any)?.test_status || 'untested').toLowerCase();"
)


with open("e:/Workspace/coveragemap/frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed TypeScript errors")
