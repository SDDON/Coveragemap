import urllib.request
import json
data = json.loads(urllib.request.urlopen('http://localhost:8001/api/graph').read())
print(f"Nodes: {len(data['nodes'])}, Edges: {len(data['edges'])}")
for e in data['edges']:
    print(e)
