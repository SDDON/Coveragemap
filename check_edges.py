import urllib.request
import json
data = json.loads(urllib.request.urlopen('http://localhost:8001/api/graph').read())
print(len(data['edges']))
