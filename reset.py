import urllib.request
try:
    req = urllib.request.Request('http://localhost:8001/api/dev/reset-seed', method='POST')
    print(urllib.request.urlopen(req).read())
except Exception as e:
    print(e)
