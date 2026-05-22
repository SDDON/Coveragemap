import re
with open('E:/Workspace/coveragemap/backend/main.py', 'r', encoding='utf-8') as f:
    c = f.read()
n = """@app.post("/api/dev/reset-seed")
def api_reset_seed():
    import subprocess, sys, os
    subprocess.run([sys.executable, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts', 'seed.py'))], check=True)
    return {"status": "success"}"""
b = re.sub(r'@app\.post\("/api/dev/reset-seed"\).*?return \{"status": "success"\}', n, c, flags=re.DOTALL)
open('E:/Workspace/coveragemap/backend/main.py', 'w', encoding='utf-8').write(b)