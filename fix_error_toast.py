import codecs

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

content = content.replace("{error && <div style={{ color: 'red', background: 'white', padding: 5, border: '1px solid red' }}>Error: {error}</div>}", '{error && <div className="error-toast" style={{ color: \'red\', background: \'white\', padding: 5, border: \'1px solid red\' }}>Error: {error}</div>}')

with codecs.open('e:/Workspace/coveragemap/frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)
