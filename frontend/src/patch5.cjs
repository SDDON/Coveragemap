const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  "      if (activeNodes.has(n.id)) {\n        cls += ' active';\n        if (outgoing.has(n.id)) cls += ' highlight-outgoing';\n        if (incoming.has(n.id)) cls += ' highlight-incoming';\n      }",
  "      if (activeNodes.has(n.id)) {\n        cls += ' active';\n        if (outgoing.has(n.id)) cls += ' highlight-outgoing';\n        if (incoming.has(n.id)) cls += ' highlight-incoming';\n      } else {\n        cls += ' de-emphasized';\n      }"
);
code = code.replace(
  "      if (activeNodes.has(n.id)) {\r\n        cls += ' active';\r\n        if (outgoing.has(n.id)) cls += ' highlight-outgoing';\r\n        if (incoming.has(n.id)) cls += ' highlight-incoming';\r\n      }",
  "      if (activeNodes.has(n.id)) {\r\n        cls += ' active';\r\n        if (outgoing.has(n.id)) cls += ' highlight-outgoing';\r\n        if (incoming.has(n.id)) cls += ' highlight-incoming';\r\n      } else {\r\n        cls += ' de-emphasized';\r\n      }"
);

code = code.replace(
  "      if (edgeHighlights.has(e.id)) {\n        cls += ' active highlight-edge';\n      }",
  "      if (edgeHighlights.has(e.id)) {\n        cls += ' active highlight-edge';\n      } else {\n        cls += ' de-emphasized';\n      }"
);
code = code.replace(
  "      if (edgeHighlights.has(e.id)) {\r\n        cls += ' active highlight-edge';\r\n      }",
  "      if (edgeHighlights.has(e.id)) {\r\n        cls += ' active highlight-edge';\r\n      } else {\r\n        cls += ' de-emphasized';\r\n      }"
);

fs.writeFileSync('App.tsx', code);
console.log('App.tsx patched de-emphasized');
