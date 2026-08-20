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
import { exportPropertiesCsv } from '../api/exportsApi.js';
import { getActivityReport } from '../api/reportsApi.js';
import { getStatuses } from '../api/statusesApi.js';
import { getTeams } from '../api/teamsApi.js';
import { getUsers } from '../api/usersApi.js';

vi.mock('../api/exportsApi.js', () => ({
  exportPropertiesCsv: vi.fn(),
}));

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
  exportPropertiesCsv.mockResolvedValue({
    blob: new Blob(['address,contactName'], { type: 'text/csv' }),
    filename: 'activity-properties.csv',
  });
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

  it('shows export control for authorized users and not for unauthorized users', async () => {
    renderAs({
      id: 'manager-3',
      organizationId: 'org-1',
      role: 'manager',
      email: 'manager3@example.com',
      firstName: 'Manager',
      lastName: 'Three',
    });

    expect(
      screen.getByRole('button', { name: 'Export CSV' }),
    ).toBeInTheDocument();

    cleanup();
    renderAs({
      id: 'rep-2',
      organizationId: 'org-1',
      role: 'rep',
      email: 'rep2@example.com',
      firstName: 'Rep',
      lastName: 'Two',
    });

    expect(
      screen.queryByRole('button', { name: 'Export CSV' }),
    ).not.toBeInTheDocument();
  });

  it('passes current filters to export API and triggers download', async () => {
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;

    window.URL.createObjectURL = vi.fn(() => 'blob:download-url');
    window.URL.revokeObjectURL = vi.fn();

    const createObjectUrlSpy = vi
      .spyOn(window.URL, 'createObjectURL')
      .mockReturnValue('blob:download-url');
    const revokeObjectUrlSpy = vi.spyOn(window.URL, 'revokeObjectURL');
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    renderAs({
      id: 'admin-2',
      organizationId: 'org-1',
      role: 'admin',
      email: 'admin2@example.com',
      firstName: 'Admin',
      lastName: 'Two',
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

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(exportPropertiesCsv).toHaveBeenCalledTimes(1);
    });

    const calledWith = exportPropertiesCsv.mock.calls[0][0];
    expect(calledWith.userId).toBe('user-1');
    expect(calledWith.teamId).toBe('team-1');
    expect(calledWith.statusId).toBe('status-1');
    expect(calledWith.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(calledWith.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledTimes(1);

    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('shows export loading and error without clearing report data', async () => {
    exportPropertiesCsv.mockRejectedValueOnce(new Error('Export failed.'));

    renderAs({
      id: 'manager-4',
      organizationId: 'org-1',
      role: 'manager',
      email: 'manager4@example.com',
      firstName: 'Manager',
      lastName: 'Four',
    });

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run report' }));

    await waitFor(() => {
      expect(screen.getByText('Total knocks: 2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Export failed.');
    });

    expect(screen.getByText('Total knocks: 2')).toBeInTheDocument();
  });
});
