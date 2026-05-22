import codecs
import re

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("status: newStatus,", "test_status: newStatus,")
content = content.replace("status: editFormData.status,", "test_status: editFormData.status,")
content = content.replace("status: n.status || 'Untested'", "status: n.test_status || 'Untested'")
content = content.replace("status: e.status || 'Untested'", "status: e.test_status || 'Untested'")
content = content.replace("n.status === 'Passed'", "n.test_status === 'Passed'")
content = content.replace("n.status === 'Failed'", "n.test_status === 'Failed'")
content = content.replace("e.status === 'Passed'", "e.test_status === 'Passed'")
content = content.replace("e.status === 'Failed'", "e.test_status === 'Failed'")

# Also fix getLayoutedElements map
content = re.sub(r'status:\s*n\.status\s*\|\|\s*\'Untested\'', "status: n.test_status || 'Untested'", content)
content = re.sub(r'status:\s*e\.status\s*\|\|\s*\'Untested\'', "status: e.test_status || 'Untested'", content)

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)
