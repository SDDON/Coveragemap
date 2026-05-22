import urllib.request
try:
    print(urllib.request.urlopen('http://localhost:8001/api/graph').read()[:200])
except Exception as e:
    print(e)
