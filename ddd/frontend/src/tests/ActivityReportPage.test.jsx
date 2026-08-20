import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { ActivityReportPage } from '../pages/ActivityReportPage.jsx';
import { getActivityReport } from '../api/reportsApi.js';
import { getStatuses } from '../api/statusesApi.js';
import { getTeams } from '../api/teamsApi.js';
import { getUsers } from '../api/usersApi.js';

vi.mock('../api/reportsApi.js', () => ({
  getActivityReport: vi.fn(),
}));

vi.mock('../api/usersApi.js', () => ({
  getUsers: vi.fn(),
}));

vi.mock('../api/teamsApi.js', () => ({
  getTeams: vi.fn(),
}));

vi.mock('../api/statusesApi.js', () => ({
  getStatuses: vi.fn(),
}));

function renderAs(user) {
  window.localStorage.setItem('joeknock.jwt', 'token');
  window.localStorage.setItem('joeknock.user', JSON.stringify(user));

  return render(
    <MemoryRouter initialEntries={['/reports/activity']}>
      <AuthProvider>
        <Routes>
          <Route path="/reports/activity" element={<ActivityReportPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();

  getUsers.mockResolvedValue([
    {
      id: 'user-1',
      firstName: 'Ava',
      lastName: 'Rep',
      email: 'ava@example.com',
    },
  ]);

  getTeams.mockResolvedValue([{ id: 'team-1', name: 'North Team' }]);
  getStatuses.mockResolvedValue([{ id: 'status-1', name: 'No Answer' }]);
  getActivityReport.mockResolvedValue({
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
      totalKnocks: 2,
      totalStatusActivityGroups: 2,
    },
    byStatus: [{ statusId: 'status-1', statusName: 'No Answer', knocks: 2 }],
    byRepresentative: [
      {
        userId: 'user-1',
        firstName: 'Ava',
        lastName: 'Rep',
        email: 'ava@example.com',
        knocks: 2,
      },
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ActivityReportPage', () => {
  it('shows permission message for non-manager and non-admin users', () => {
    renderAs({
      id: 'rep-1',
      organizationId: 'org-1',
      role: 'rep',
      email: 'rep@example.com',
      firstName: 'Rep',
      lastName: 'One',
    });

    expect(
      screen.getByText('You do not have permission to view reports.'),
    ).toBeInTheDocument();

    expect(getActivityReport).not.toHaveBeenCalled();
  });

  it('loads filter options and runs report for manager users', async () => {
    renderAs({
      id: 'manager-1',
      organizationId: 'org-1',
      role: 'manager',
      email: 'manager@example.com',
      firstName: 'Manager',
      lastName: 'One',
    });

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledTimes(1);
      expect(getTeams).toHaveBeenCalledTimes(1);
      expect(getStatuses).toHaveBeenCalledTimes(1);
    });

    const runButton = screen.getByRole('button', { name: 'Run report' });
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(getActivityReport).toHaveBeenCalledTimes(1);
    });

    const statusSection = screen.getByRole('region', {
      name: 'Status grouping',
    });
    const representativeSection = screen.getByRole('region', {
      name: 'Representative grouping',
    });

    expect(screen.getByText('Total knocks: 2')).toBeInTheDocument();
    expect(within(statusSection).getByText('No Answer')).toBeInTheDocument();
    expect(
      within(representativeSection).getByText('Ava Rep (ava@example.com)'),
    ).toBeInTheDocument();
  });

  it('submits selected optional filters in the report request', async () => {
    renderAs({
      id: 'admin-1',
      organizationId: 'org-1',
      role: 'admin',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'One',
    });

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Representative'), {
      target: { value: 'user-1' },
    });
    fireEvent.change(screen.getByLabelText('Team'), {
      target: { value: 'team-1' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'status-1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run report' }));

    await waitFor(() => {
      expect(getActivityReport).toHaveBeenCalledTimes(1);
    });

    const calledWith = getActivityReport.mock.calls[0][0];
    expect(calledWith.userId).toBe('user-1');
    expect(calledWith.teamId).toBe('team-1');
    expect(calledWith.statusId).toBe('status-1');
    expect(calledWith.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(calledWith.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shows report loading and handles API failure', async () => {
    getActivityReport.mockRejectedValueOnce(
      new Error('Unable to load activity report.'),
    );

    renderAs({
      id: 'manager-2',
      organizationId: 'org-1',
      role: 'manager',
      email: 'manager2@example.com',
      firstName: 'Manager',
      lastName: 'Two',
    });

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run report' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to load activity report.',
      );
    });
  });
});
