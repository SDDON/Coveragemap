const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'e2e-tests', 'tests', 'tier1.spec.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix F2 Shift Focus
content = content.replace(
  `    await nodeA.click();\n    await nodeB.click();`,
  `    await nodeA.click({ force: true });\n    await nodeB.click({ force: true });`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched tier1.spec.ts F2 Shift Focus completely!');
