const { test, expect } = require('@playwright/test');

// Mock test generator to demonstrate F2 Restore Context vulnerability
async function simulateF2RestoreContextRace() {
  let isDeEmphasized = false;
  
  // App logic (slow render)
  async function simulateApp() {
    return {
      clickNode: () => {
        // App takes 50ms to render the focus state
        setTimeout(() => { isDeEmphasized = true; }, 50);
      },
      clickPane: () => {
        // App takes 50ms to restore context
        setTimeout(() => { isDeEmphasized = false; }, 50);
      }
    };
  }
  
  const app = await simulateApp();
  
  // Test execution
  app.clickNode();
  // The test does NOT wait for the state to update!
  app.clickPane();
  
  // Assertion runs immediately
  const pass = !isDeEmphasized; 
  console.log("Did test pass?", pass);
  // It passes because isDeEmphasized is false at T=0.
  // The test didn't verify that the focus actually occurred before testing the restore!
}

simulateF2RestoreContextRace();
