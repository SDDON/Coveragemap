with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "let cls = (n.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim();",
    "let cls = (n.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z]+)\\b/g, '').trim(); cls += ' status-' + ((n.data && n.data.status) ? n.data.status.toLowerCase() : 'untested');"
)

content = content.replace(
    "let cls = (e.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim();",
    "let cls = (e.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z]+)\\b/g, '').trim(); cls += ' status-' + ((e.status) ? e.status.toLowerCase() : 'untested');"
)

content = content.replace(
    "styledNodes: nodes.map(n => ({ ...n, className: (n.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim() })),",
    "styledNodes: nodes.map(n => ({ ...n, className: ((n.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z]+)\\b/g, '').trim() + ' status-' + ((n.data && n.data.status) ? n.data.status.toLowerCase() : 'untested')).trim() })),"
)

content = content.replace(
    "styledEdges: edges.map(e => ({ ...e, className: (e.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+)\\b/g, '').trim() }))",
    "styledEdges: edges.map(e => ({ ...e, className: ((e.className || '').replace(/\\b(de-emphasized|active|highlight-[a-z-]+|status-[a-z]+)\\b/g, '').trim() + ' status-' + ((e.status) ? e.status.toLowerCase() : 'untested')).trim() }))"
)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
