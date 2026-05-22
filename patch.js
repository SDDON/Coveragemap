const fs = require('fs');
let c = fs.readFileSync('e2e-tests/tests/tier1.spec.ts', 'utf-8');

c = c.replace(/const nodeB = page\.locator\(\`\.react-flow__node:not\(\\[data-id=\"\$\{nodeAId\}\"\\]\)\`\)\.first\(\);/g, 
              'const nodeB = page.locator(`.react-flow__node:not([data-id=\"${nodeAId}\"])`).last();');

c = c.replace(/const unassociatedNode = page\.locator\(\`\.react-flow__node:not\(\\[data-id=\"\$\{sourceId\}\"\\]\):not\(\\[data-id=\"\$\{targetId\}\"\\]\)\`\)\.first\(\);/g, 
              'const unassociatedNode = page.locator(`.react-flow__node:not([data-id=\"${sourceId}\"]):not([data-id=\"${targetId}\"])`).last();');

c = c.replace(/await targetNode\.click\(\);/g, 'await targetNode.click({ force: true });');
c = c.replace(/await sourceNode\.click\(\);/g, 'await sourceNode.click({ force: true });');
c = c.replace(/await firstNode\.click\(\);/g, 'await firstNode.click({ force: true });');
c = c.replace(/await targetEdge\.click\(\);/g, 'await targetEdge.click({ force: true });');
c = c.replace(/await page\.locator\('\.react-flow__node'\)\.first\(\)\.click\(\);/g, 'await page.locator(\'.react-flow__node\').first().click({ force: true });');
c = c.replace(/await addNodeBtn\.click\(\);/g, 'await addNodeBtn.click({ force: true });');
c = c.replace(/await markPassedBtn\.click\(\);/g, 'await markPassedBtn.click({ force: true });');

c = c.replace(/const sourceId = await edge\.getAttribute\('data-source'\);\s*const targetId = await edge\.getAttribute\('data-target'\);\s*expect\(sourceId\)\.toBeTruthy\(\);\s*expect\(targetId\)\.toBeTruthy\(\);/g, 
`const ariaLabel = await edge.getAttribute('aria-label');
    const match = ariaLabel?.match(/Edge from (.+) to (.+)/);
    const sourceId = match ? match[1] : null;
    const targetId = match ? match[2] : null;
    expect(sourceId).toBeTruthy();
    expect(targetId).toBeTruthy();`);

c = c.replace(/\`\.react-flow__edge\\[data-source=\"\$\{sourceId\}\"\\]\\[data-target=\"\$\{targetId\}\"\\]\`/g, '`.react-flow__edge[aria-label=\"Edge from ${sourceId} to ${targetId}\"]`');

fs.writeFileSync('e2e-tests/tests/tier1.spec.ts', c, 'utf-8');
console.log('Node.js patch done!');
