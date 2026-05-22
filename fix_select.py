import codecs
import re

with codecs.open('frontend/src/App.tsx', 'r', 'utf-8') as f:
    content = f.read()

select_orig = re.compile(r'<label>Status:</label>\s*<select value=\{editFormData\.status \|\| \'Untested\'\} onChange=\{e => setEditFormData\(\{\.\.\.editFormData, status: e\.target\.value\}\)\}>\s*<option value="Untested">Untested</option>\s*<option value="Passed">Passed</option>\s*<option value="Failed">Failed</option>\s*</select>\s*<button style=\{\{\s*marginTop: \'10px\',\s*padding: \'6px\',\s*background: \'#4CAF50\',\s*color: \'white\',\s*border: \'none\',\s*borderRadius: \'4px\',\s*cursor: \'pointer\'\s*\}\}\s*onClick=\{handleSave\}>\s*Save\s*</button>')

select_new = '''<label>Status:</label>
            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus('Passed'); }}>Mark Passed</button>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus('Failed'); }}>Mark Failed</button>
              <button onClick={(e) => { e.preventDefault(); handleSaveStatus('Untested'); }}>Reset Status</button>
            </div>
            <button style={{ marginTop: '10px', padding: '6px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={handleSave}>
              Save
            </button>'''

if select_orig.search(content):
    content = select_orig.sub(select_new, content)
    print("MATCHED AND REPLACED SELECT")
else:
    print("FAILED TO MATCH SELECT")

# Also let's fix the invalid fetch literal from earlier: await fetch(http://localhost:8001/api/edges/, {
# Oh wait, my earlier string replace literally output wait fetch(http://localhost:8001/api/edges/, { because it evaluated PowerShell variable $editFormData.id as empty!
# Oh my god! $editFormData.id was evaluated in PowerShell!
content = content.replace('await fetch(http://localhost:8001/api/edges/, {', 'await fetch(http://localhost:8001/api/edges/, {')
content = content.replace('await fetch(http://localhost:8001/api/nodes/, {', 'await fetch(http://localhost:8001/api/nodes/, {')

with codecs.open('frontend/src/App.tsx', 'w', 'utf-8') as f:
    f.write(content)

print("SUCCESS")
