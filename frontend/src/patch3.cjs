const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  "setError(null);\n        } catch",
  "setError(null);\n          setTimeout(() => { if (window.rfInstance) window.rfInstance.fitView({ duration: 200, padding: 0.1 }); }, 50);\n        } catch"
);
code = code.replace(
  "setError(null);\r\n        } catch",
  "setError(null);\r\n          setTimeout(() => { if (window.rfInstance) window.rfInstance.fitView({ duration: 200, padding: 0.1 }); }, 50);\r\n        } catch"
);

fs.writeFileSync('App.tsx', code);
console.log('App.tsx patched again');
