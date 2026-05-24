import { test, expect } from '@playwright/test';

test.describe('Multiple Issue Links on Badge Tooltip', () => {

  test.beforeEach(async ({ page }) => {
    // Clear localStorage to default state
    await page.addInitScript(() => {
      window.localStorage.setItem('savedShowAll', 'true');
    });
  });

  test('Renders multiple links when issue_link contains comma and space separated URLs', async ({ page }) => {
    // Mock the backend API for globals
    await page.route('**/api/globals', async route => {
      const json = [
        {
          id: 'test-global-1',
          name: 'TEST_GLOBAL',
          type: 'Node',
          properties: {
            is_global: 'true',
            description: 'This is a mocked global node',
            issue_link: 'https://jira.com/issue-1\nhttp://github.com/issue-2, jira.com/issue-3'
          }
        }
      ];
      await route.fulfill({ json });
    });

    // We also need to mock /api/graph to ensure we have a node that has an edge to this global node.
    await page.route('**/api/graph*', async route => {
      const json = {
        nodes: [
          { id: 'node-1', name: 'TEST_NODE', label: 'Screen', aliases: [], properties: {} },
          { id: 'test-global-1', name: 'TEST_GLOBAL', label: 'Node', aliases: [], properties: { is_global: 'true', issue_link: 'https://jira.com/issue-1\nhttp://github.com/issue-2, jira.com/issue-3' } }
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'test-global-1', type: 'DEPENDS_ON', properties: { test_status: 'Untested' } }
        ]
      };
      await route.fulfill({ json });
    });

    // Navigate to frontend
    await page.goto('http://localhost:5173');
    
    // Wait for the graph to load
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    // Verify the badge exists
    const badge = page.locator('.badge-pill').first();
    await expect(badge).toBeVisible();

    // The tooltip is rendered when badge.properties?.issue_link exists.
    // Let's hover over the badge to show the tooltip.
    await badge.hover();
    
    // Verify the links exist in the tooltip.
    const tooltip = page.locator('.badge-tooltip').first();
    await expect(tooltip).toBeVisible();

    const links = tooltip.locator('a');
    await expect(links).toHaveCount(3);
    
    // Check link 1
    await expect(links.nth(0)).toHaveAttribute('href', 'https://jira.com/issue-1');
    await expect(links.nth(0)).toHaveText('jira.com');

    // Check link 2
    await expect(links.nth(1)).toHaveAttribute('href', 'http://github.com/issue-2');
    await expect(links.nth(1)).toHaveText('github.com');

    // Check link 3
    await expect(links.nth(2)).toHaveAttribute('href', 'https://jira.com/issue-3');
    await expect(links.nth(2)).toHaveText('jira.com');
  });
});
