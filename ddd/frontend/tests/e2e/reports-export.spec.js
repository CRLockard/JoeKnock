import { test, expect } from '@playwright/test';

test('manager can apply filters and request CSV export from Activity Report', async ({
  page,
}) => {
  // Verify frontend sends filter-parity query params to export endpoint.
  await page.route('**/api/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'user-1',
          firstName: 'Manny',
          lastName: 'Manager',
          email: 'manager@example.com',
        },
      ]),
    });
  });

  await page.route('**/api/teams', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'team-1', name: 'Alpha Team' }]),
    });
  });

  await page.route('**/api/statuses', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'status-1', name: 'Interested' }]),
    });
  });

  await page.route('**/api/reports/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        dateRange: {
          dateFrom: '2026-08-01',
          dateTo: '2026-08-02',
          timezone: 'UTC',
        },
        appliedFilters: {
          userId: null,
          teamId: null,
          statusId: null,
        },
        summary: {
          totalKnocks: 1,
          totalStatusActivityGroups: 1,
        },
        byStatus: [
          {
            statusId: 'status-1',
            statusName: 'Interested',
            knocks: 1,
          },
        ],
        byRepresentative: [
          {
            userId: 'user-1',
            firstName: 'Manny',
            lastName: 'Manager',
            email: 'manager@example.com',
            knocks: 1,
          },
        ],
      }),
    });
  });

  let exportRequestUrl = null;

  await page.route('**/api/exports/properties**', async (route) => {
    exportRequestUrl = route.request().url();

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="activity-properties.csv"',
      },
      body: [
        'address,contactName,phone,currentStatus,representative,interactionDate',
        '123 Main St,Ada,555-0000,Interested,Manny Manager,2026-08-01 10:00:00',
      ].join('\r\n'),
    });
  });

  await page.goto('/login');

  await page.evaluate(() => {
    localStorage.setItem('joeknock.jwt', 'test-token');
    localStorage.setItem(
      'joeknock.user',
      JSON.stringify({
        id: 'manager-1',
        organizationId: 'org-1',
        role: 'manager',
        email: 'manager@example.com',
        firstName: 'Manny',
        lastName: 'Manager',
      }),
    );
  });

  await page.goto('/reports/activity');

  await expect(
    page.getByRole('heading', { name: 'Activity Report' }),
  ).toBeVisible();

  const filtersForm = page.getByRole('form', {
    name: 'activity report filters',
  });

  await filtersForm
    .getByRole('combobox', { name: 'Representative' })
    .selectOption('user-1');
  await filtersForm
    .getByRole('combobox', { name: 'Team' })
    .selectOption('team-1');
  await filtersForm
    .getByRole('combobox', { name: 'Status' })
    .selectOption('status-1');

  await page.getByRole('button', { name: 'Export CSV' }).click();

  await expect.poll(() => exportRequestUrl).not.toBeNull();
  expect(exportRequestUrl).toContain('/api/exports/properties?');
  expect(exportRequestUrl).toContain('userId=user-1');
  expect(exportRequestUrl).toContain('teamId=team-1');
  expect(exportRequestUrl).toContain('statusId=status-1');

  await expect(page.getByRole('alert')).toHaveCount(0);
});
