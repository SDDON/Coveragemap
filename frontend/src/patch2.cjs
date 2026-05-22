const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  "{error && <div style={{ color: 'red', background: 'white', padding: 5, border: '1px solid red' }}>Error: {error}</div>}",
  "{error && <div className=\"error-toast\" style={{ color: 'red', background: 'white', padding: 5, border: '1px solid red' }}>Error: {error}</div>}"
);

code = code.replace(
  "{loading && (\n        <div style={{",
  "{loading && (\n        <div data-testid=\"loading-overlay\" style={{"
);
code = code.replace(
  "{loading && (\r\n        <div style={{",
  "{loading && (\r\n        <div data-testid=\"loading-overlay\" style={{"
);

code = code.replace(
  "<ReactFlow",
  "<ReactFlow onInit={(instance) => { window.rfInstance = instance; }} "
);

code = code.replace(
  "setError(null);\n        } catch",
  "setError(null);\n          setTimeout(() => { if (window.rfInstance) window.rfInstance.fitView({ duration: 200, padding: 0.1 }); }, 50);\n        } catch"
);
code = code.replace(
  "setError(null);\r\n        } catch",
  "setError(null);\r\n          setTimeout(() => { if (window.rfInstance) window.rfInstance.fitView({ duration: 200, padding: 0.1 }); }, 50);\r\n        } catch"
);

fs.writeFileSync('App.tsx', code);
console.log('App.tsx patched cleanly');
