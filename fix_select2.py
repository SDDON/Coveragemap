import codecs
import re

with codecs.open('frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

select_orig = re.compile(r'<label>Status:</label>[\s\S]*?</button>')

select_new = '''<label>Status:</label>
            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus('Passed'); }}>Mark Passed</button>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus('Failed'); }}>Mark Failed</button>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus('Untested'); }}>Reset Status</button>
            </div>
            <button style={{ marginTop: '10px', padding: '6px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={handleSave}>
              Save
            </button>'''

matches = select_orig.findall(content)
if len(matches) > 0:
    # Only replace the last match or specific match
    for m in matches:
        if '<select value={editFormData.status' in m:
            content = content.replace(m, select_new)
            print("MATCHED AND REPLACED SELECT")

with codecs.open('frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)
