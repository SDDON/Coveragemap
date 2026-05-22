import urllib.request
import json
try:
    data = json.loads(urllib.request.urlopen('http://localhost:8001/api/graph').read())
    nodes = data['nodes']
    source = nodes[0]['id']
    target = nodes[1]['id']
    
    payload = json.dumps({
        "source": source,
        "target": target,
        "type": "Transition",
        "properties": {"dummy": "value"},
        "test_status": "Untested"
    }).encode('utf-8')
    
    req = urllib.request.Request('http://localhost:8001/api/edges', data=payload, method='POST', headers={'Content-Type': 'application/json'})
    print(urllib.request.urlopen(req).read())
except Exception as e:
    print(e)
