import urllib.request
import json
try:
    # Get nodes first
    data = json.loads(urllib.request.urlopen('http://localhost:8001/api/graph').read())
    nodes = data['nodes']
    if len(nodes) >= 2:
        source = nodes[0]['id']
        target = nodes[1]['id']
        
        payload = json.dumps({
            "source": source,
            "target": target,
            "type": "Transition",
            "properties": {},
            "test_status": "Untested"
        }).encode('utf-8')
        
        req = urllib.request.Request('http://localhost:8001/api/edges', data=payload, method='POST', headers={'Content-Type': 'application/json'})
        print(urllib.request.urlopen(req).read())
    else:
        print("Not enough nodes to create an edge!")
except Exception as e:
    print(e)
