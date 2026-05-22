const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /setError\(null\);\s*\} catch/g,
  "setError(null);\nsetTimeout(() => { if (window.rfInstance) window.rfInstance.fitView({ duration: 200, padding: 0.1 }); }, 100);\n} catch"
);

fs.writeFileSync('App.tsx', code);
console.log('App.tsx patched regex');
