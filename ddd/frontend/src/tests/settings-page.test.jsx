import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { App } from '../app/App.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { SettingsPage } from '../pages/SettingsPage.jsx';
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx';
import {
  getOrganization,
  getOrganizationSettings,
  updateOrganization,
  updateOrganizationSettings,
} from '../api/organizationApi.js';
import {
  createStatus,
  getStatuses,
  setStatusActive,
  updateStatus,
} from '../api/statusesApi.js';
import { getUsers } from '../api/usersApi.js';
import {
  addUserToTeam,
  createTeam,
  getTeam,
  getTeams,
  removeUserFromTeam,
} from '../api/teamsApi.js';

vi.mock('../api/organizationApi.js', () => ({
  getOrganization: vi.fn(),
  getOrganizationSettings: vi.fn(),
  updateOrganization: vi.fn(),
  updateOrganizationSettings: vi.fn(),
}));

vi.mock('../api/teamsApi.js', () => ({
  addUserToTeam: vi.fn(),
  createTeam: vi.fn(),
  getTeam: vi.fn(),
  getTeams: vi.fn(),
  removeUserFromTeam: vi.fn(),
}));

vi.mock('../api/statusesApi.js', () => ({
  createStatus: vi.fn(),
  getStatuses: vi.fn(),
  setStatusActive: vi.fn(),
  updateStatus: vi.fn(),
}));

vi.mock('../api/usersApi.js', () => ({
  getUsers: vi.fn(),
}));

function setStoredUser(role) {
  localStorage.setItem('joeknock.jwt', 'token-123');
  localStorage.setItem(
    'joeknock.user',
    JSON.stringify({
      id: 'user-1',
      organizationId: 'org-1',
      firstName: 'Corey',
      lastName: 'Lopez',
      email: 'corey@example.com',
      role,
      isActive: true,
    }),
  );
}

function renderSettings(initialEntries = ['/settings']) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/" element={<App />}>
            <Route path="login" element={<LoginPage />} />
            <Route
              path="settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  getTeams.mockResolvedValue([]);
  getUsers.mockResolvedValue([]);
  getStatuses.mockResolvedValue([]);
  getOrganizationSettings.mockResolvedValue({
    id: 'settings-1',
    organizationId: 'org-1',
    repVisibility: 'own',
    timezone: 'UTC',
  });
  updateOrganizationSettings.mockResolvedValue({
    id: 'settings-1',
    organizationId: 'org-1',
    repVisibility: 'team',
    timezone: 'America/New_York',
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('settings page', () => {
  it('loads organization info and allows admin update', async () => {
    setStoredUser('admin');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Original Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    updateOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Renamed Org',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    renderSettings(['/settings']);

    expect(
      await screen.findByText('Organization Settings'),
    ).toBeInTheDocument();

    const input = await screen.findByLabelText('Organization name');
    expect(input).toHaveValue('Original Name');

    fireEvent.change(input, { target: { value: 'Renamed Org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save organization' }));

    await waitFor(() => {
      expect(updateOrganization).toHaveBeenCalledWith({ name: 'Renamed Org' });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Organization updated successfully.',
    );
    expect(screen.getByLabelText('Organization name')).toHaveValue(
      'Renamed Org',
    );
  });

  it('loads and renders teams for an authorized manager', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'Alpha Team',
      },
      {
        id: 'team-2',
        organizationId: 'org-1',
        name: 'Beta Team',
      },
    ]);

    getUsers.mockResolvedValue([]);

    renderSettings(['/settings']);

    expect(await screen.findByText('Alpha Team')).toBeInTheDocument();
    expect(screen.getByText('Beta Team')).toBeInTheDocument();
    expect(getTeams).toHaveBeenCalledTimes(1);
  });

  it('loads and renders active statuses', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getStatuses.mockResolvedValue([
      {
        id: 'status-1',
        organizationId: 'org-1',
        name: 'No Answer',
        description: 'No contact established',
        displayOrder: 1,
        isActive: true,
      },
      {
        id: 'status-2',
        organizationId: 'org-1',
        name: 'Interested',
        description: null,
        displayOrder: 2,
        isActive: true,
      },
    ]);

    renderSettings(['/settings']);

    expect(
      await screen.findByText('No Answer (order: 1) - No contact established'),
    ).toBeInTheDocument();
    expect(screen.getByText('Interested (order: 2)')).toBeInTheDocument();
    expect(getStatuses).toHaveBeenCalledTimes(1);
  });

  it('allows representative to view active organization statuses', async () => {
    setStoredUser('rep');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getStatuses.mockResolvedValue([
      {
        id: 'status-1',
        organizationId: 'org-1',
        name: 'No Answer',
        description: 'No contact established',
        displayOrder: 1,
        isActive: true,
      },
      {
        id: 'status-2',
        organizationId: 'org-1',
        name: 'Interested',
        description: null,
        displayOrder: 2,
        isActive: true,
      },
    ]);

    renderSettings(['/settings']);

    expect(
      await screen.findByText('No Answer (order: 1) - No contact established'),
    ).toBeInTheDocument();
    expect(screen.getByText('Interested (order: 2)')).toBeInTheDocument();
    expect(getStatuses).toHaveBeenCalledTimes(1);
  });

  it('allows manager to create a status', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getStatuses.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'status-1',
        organizationId: 'org-1',
        name: 'Not Home',
        description: 'No one answered door',
        displayOrder: 3,
        isActive: true,
      },
    ]);

    createStatus.mockResolvedValue({
      id: 'status-1',
      organizationId: 'org-1',
      name: 'Not Home',
      description: 'No one answered door',
      displayOrder: 3,
      isActive: true,
    });

    renderSettings(['/settings']);

    await screen.findByText('No active statuses found.');

    fireEvent.change(screen.getByLabelText('Status name'), {
      target: { value: 'Not Home' },
    });
    fireEvent.change(screen.getByLabelText('Status description'), {
      target: { value: 'No one answered door' },
    });
    fireEvent.change(screen.getByLabelText('Display order'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create status' }));

    await waitFor(() => {
      expect(createStatus).toHaveBeenCalledWith({
        name: 'Not Home',
        description: 'No one answered door',
        displayOrder: 3,
      });
    });

    expect(
      await screen.findByText('Status created successfully.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Not Home (order: 3) - No one answered door'),
    ).toBeInTheDocument();
  });

  it('allows admin to update an existing status', async () => {
    setStoredUser('admin');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getStatuses
      .mockResolvedValueOnce([
        {
          id: 'status-1',
          organizationId: 'org-1',
          name: 'Interested',
          description: '',
          displayOrder: 1,
          isActive: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'status-1',
          organizationId: 'org-1',
          name: 'Very Interested',
          description: 'Requested callback',
          displayOrder: 4,
          isActive: true,
        },
      ]);

    updateStatus.mockResolvedValue({
      id: 'status-1',
      organizationId: 'org-1',
      name: 'Very Interested',
      description: 'Requested callback',
      displayOrder: 4,
      isActive: true,
    });

    renderSettings(['/settings']);

    await screen.findByText('Interested (order: 1)');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Interested' }));

    fireEvent.change(screen.getByLabelText('Edit status name'), {
      target: { value: 'Very Interested' },
    });
    fireEvent.change(screen.getByLabelText('Edit status description'), {
      target: { value: 'Requested callback' },
    });
    fireEvent.change(screen.getByLabelText('Edit display order'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save status' }));

    await waitFor(() => {
      expect(updateStatus).toHaveBeenCalledWith('status-1', {
        name: 'Very Interested',
        description: 'Requested callback',
        displayOrder: 4,
      });
    });

    expect(
      await screen.findByText('Status updated successfully.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Very Interested (order: 4) - Requested callback',
      ),
    ).toBeInTheDocument();
  });

  it('allows admin to deactivate a status and removes it from active list', async () => {
    setStoredUser('admin');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getStatuses
      .mockResolvedValueOnce([
        {
          id: 'status-1',
          organizationId: 'org-1',
          name: 'Keep Me',
          description: null,
          displayOrder: 1,
          isActive: true,
        },
        {
          id: 'status-2',
          organizationId: 'org-1',
          name: 'Deactivate Me',
          description: null,
          displayOrder: 2,
          isActive: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'status-1',
          organizationId: 'org-1',
          name: 'Keep Me',
          description: null,
          displayOrder: 1,
          isActive: true,
        },
      ]);

    setStatusActive.mockResolvedValue({
      id: 'status-2',
      organizationId: 'org-1',
      name: 'Deactivate Me',
      description: null,
      displayOrder: 2,
      isActive: false,
    });

    renderSettings(['/settings']);

    await screen.findByText('Deactivate Me (order: 2)');
    fireEvent.click(
      screen.getByRole('button', { name: 'Deactivate Deactivate Me' }),
    );

    await waitFor(() => {
      expect(setStatusActive).toHaveBeenCalledWith('status-2', false);
    });

    expect(
      await screen.findByText('Status deactivated successfully.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Deactivate Me (order: 2)')).toBeNull();
    expect(screen.getByText('Keep Me (order: 1)')).toBeInTheDocument();
  });

  it('renders teams loading state', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    let resolveTeams;
    getTeams.mockReturnValue(
      new Promise((resolve) => {
        resolveTeams = resolve;
      }),
    );

    renderSettings(['/settings']);

    expect(await screen.findByText('Loading teams...')).toBeInTheDocument();

    resolveTeams([]);
    await screen.findByText('No teams found.');
  });

  it('renders empty team state correctly', async () => {
    setStoredUser('admin');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([]);

    renderSettings(['/settings']);

    expect(await screen.findByText('No teams found.')).toBeInTheDocument();
  });

  it('renders teams API load error', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockRejectedValue(new Error('Unable to load teams.'));

    renderSettings(['/settings']);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load teams.',
    );
  });

  it('renders non-admin as read-only with no save action', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderSettings(['/settings']);

    const input = await screen.findByLabelText('Organization name');

    expect(input).toBeDisabled();
    expect(
      screen.getByText(
        'Only administrators can update organization information.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save organization' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create team' })).toBeEnabled();
  });

  it('allows manager to create a team', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    createTeam.mockResolvedValue({
      id: 'team-1',
      organizationId: 'org-1',
      name: 'North Knoxville',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderSettings(['/settings']);

    await screen.findByText('Organization Settings');

    fireEvent.change(screen.getByLabelText('Team name'), {
      target: { value: 'North Knoxville' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));

    await waitFor(() => {
      expect(createTeam).toHaveBeenCalledWith({ name: 'North Knoxville' });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Created team North Knoxville.',
    );
    expect(screen.getByText('North Knoxville')).toBeInTheDocument();
  });

  it('loads and renders team members when viewing team detail', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
      },
    ]);

    getTeam.mockResolvedValue({
      id: 'team-1',
      organizationId: 'org-1',
      name: 'North Team',
      members: [
        {
          id: 'user-1',
          organizationId: 'org-1',
          firstName: 'Ana',
          lastName: 'Able',
          email: 'ana@example.com',
          role: 'rep',
          isActive: true,
        },
      ],
    });

    getUsers.mockResolvedValue([
      {
        id: 'user-2',
        organizationId: 'org-1',
        firstName: 'Ben',
        lastName: 'Baker',
        email: 'ben@example.com',
        role: 'rep',
        isActive: true,
      },
    ]);

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(
      screen.getByRole('button', { name: 'North Team View details' }),
    );

    await waitFor(() => {
      expect(getTeam).toHaveBeenCalledWith('team-1');
    });

    expect(
      await screen.findByText('Ana Able (ana@example.com) - rep'),
    ).toBeInTheDocument();

    expect(screen.getByLabelText('Team member')).toBeInTheDocument();
    expect(
      screen.getByRole('option', {
        name: 'Ben Baker (ben@example.com)',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: 'Remove Ana Able' }),
    ).toBeInTheDocument();
  });

  it('removes a selected team member and refreshes team detail', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
      },
    ]);

    getUsers.mockResolvedValue([]);

    getTeam
      .mockResolvedValueOnce({
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
        members: [
          {
            id: 'user-1',
            organizationId: 'org-1',
            firstName: 'Ana',
            lastName: 'Able',
            email: 'ana@example.com',
            role: 'rep',
            isActive: true,
          },
          {
            id: 'user-2',
            organizationId: 'org-1',
            firstName: 'Ben',
            lastName: 'Baker',
            email: 'ben@example.com',
            role: 'rep',
            isActive: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
        members: [
          {
            id: 'user-2',
            organizationId: 'org-1',
            firstName: 'Ben',
            lastName: 'Baker',
            email: 'ben@example.com',
            role: 'rep',
            isActive: true,
          },
        ],
      });

    removeUserFromTeam.mockResolvedValue({
      organizationId: 'org-1',
      teamId: 'team-1',
      userId: 'user-1',
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(
      screen.getByRole('button', { name: 'North Team View details' }),
    );
    await screen.findByText('Ana Able (ana@example.com) - rep');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ana Able' }));

    await waitFor(() => {
      expect(removeUserFromTeam).toHaveBeenCalledWith('team-1', 'user-1');
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Team member removed successfully.',
    );
    expect(screen.queryByText('Ana Able (ana@example.com) - rep')).toBeNull();
    expect(
      await screen.findByText('Ben Baker (ben@example.com) - rep'),
    ).toBeInTheDocument();
  });

  it('does not remove member when confirmation is canceled', async () => {
    window.confirm.mockReturnValue(false);
    setStoredUser('admin');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
      },
    ]);

    getUsers.mockResolvedValue([]);

    getTeam.mockResolvedValue({
      id: 'team-1',
      organizationId: 'org-1',
      name: 'North Team',
      members: [
        {
          id: 'user-1',
          organizationId: 'org-1',
          firstName: 'Ana',
          lastName: 'Able',
          email: 'ana@example.com',
          role: 'rep',
          isActive: true,
        },
      ],
    });

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(screen.getByRole('button', { name: /View details/ }));
    await screen.findByText('Ana Able (ana@example.com) - rep');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ana Able' }));

    expect(removeUserFromTeam).not.toHaveBeenCalled();
  });

  it('shows loading state while removing a member', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
      },
    ]);

    getUsers.mockResolvedValue([]);

    getTeam.mockResolvedValue({
      id: 'team-1',
      organizationId: 'org-1',
      name: 'North Team',
      members: [
        {
          id: 'user-1',
          organizationId: 'org-1',
          firstName: 'Ana',
          lastName: 'Able',
          email: 'ana@example.com',
          role: 'rep',
          isActive: true,
        },
      ],
    });

    let resolveRemoval;
    removeUserFromTeam.mockReturnValue(
      new Promise((resolve) => {
        resolveRemoval = resolve;
      }),
    );

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(screen.getByRole('button', { name: /View details/ }));
    await screen.findByText('Ana Able (ana@example.com) - rep');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ana Able' }));

    expect(
      await screen.findByRole('button', { name: 'Removing member...' }),
    ).toBeDisabled();

    resolveRemoval({
      organizationId: 'org-1',
      teamId: 'team-1',
      userId: 'user-1',
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    await waitFor(() => {
      expect(removeUserFromTeam).toHaveBeenCalledWith('team-1', 'user-1');
    });
  });

  it('shows API error when member removal fails', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
      },
    ]);

    getUsers.mockResolvedValue([]);

    getTeam.mockResolvedValue({
      id: 'team-1',
      organizationId: 'org-1',
      name: 'North Team',
      members: [
        {
          id: 'user-1',
          organizationId: 'org-1',
          firstName: 'Ana',
          lastName: 'Able',
          email: 'ana@example.com',
          role: 'rep',
          isActive: true,
        },
      ],
    });

    removeUserFromTeam.mockRejectedValue(
      new Error('Team membership not found.'),
    );

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(screen.getByRole('button', { name: /View details/ }));
    await screen.findByText('Ana Able (ana@example.com) - rep');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ana Able' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Team membership not found.',
    );
  });

  it('adds a selected user to a team and refreshes team detail', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
      },
    ]);

    getUsers.mockResolvedValue([
      {
        id: 'user-2',
        organizationId: 'org-1',
        firstName: 'Ben',
        lastName: 'Baker',
        email: 'ben@example.com',
        role: 'rep',
        isActive: true,
      },
    ]);

    getTeam
      .mockResolvedValueOnce({
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
        members: [],
      })
      .mockResolvedValueOnce({
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
        members: [
          {
            id: 'user-2',
            organizationId: 'org-1',
            firstName: 'Ben',
            lastName: 'Baker',
            email: 'ben@example.com',
            role: 'rep',
            isActive: true,
          },
        ],
      });

    addUserToTeam.mockResolvedValue({
      organizationId: 'org-1',
      teamId: 'team-1',
      userId: 'user-2',
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(screen.getByRole('button', { name: /View details/ }));

    await screen.findByText('No team members assigned.');

    fireEvent.change(screen.getByLabelText('Team member'), {
      target: { value: 'user-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(() => {
      expect(addUserToTeam).toHaveBeenCalledWith('team-1', {
        userId: 'user-2',
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Team member added successfully.',
    );

    expect(
      await screen.findByText('Ben Baker (ben@example.com) - rep'),
    ).toBeInTheDocument();
  });

  it('shows validation error when team member selection is blank', async () => {
    setStoredUser('admin');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
      },
    ]);

    getUsers.mockResolvedValue([]);
    getTeam.mockResolvedValue({
      id: 'team-1',
      organizationId: 'org-1',
      name: 'North Team',
      members: [],
    });

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(screen.getByRole('button', { name: /View details/ }));
    await screen.findByText('No team members assigned.');

    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User selection is required.',
    );
    expect(addUserToTeam).not.toHaveBeenCalled();
  });

  it('shows API error when add team member fails', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
      },
    ]);

    getUsers.mockResolvedValue([
      {
        id: 'user-2',
        organizationId: 'org-1',
        firstName: 'Ben',
        lastName: 'Baker',
        email: 'ben@example.com',
        role: 'rep',
        isActive: true,
      },
    ]);

    getTeam.mockResolvedValue({
      id: 'team-1',
      organizationId: 'org-1',
      name: 'North Team',
      members: [],
    });

    addUserToTeam.mockRejectedValue(
      new Error('User is already a member of this team.'),
    );

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(screen.getByRole('button', { name: /View details/ }));
    await screen.findByText('No team members assigned.');

    fireEvent.change(screen.getByLabelText('Team member'), {
      target: { value: 'user-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User is already a member of this team.',
    );
  });

  it('renders empty member state for a team detail view', async () => {
    setStoredUser('admin');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
      },
    ]);

    getTeam.mockResolvedValue({
      id: 'team-1',
      organizationId: 'org-1',
      name: 'North Team',
      members: [],
    });

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(screen.getByRole('button', { name: /View details/ }));

    expect(
      await screen.findByText('No team members assigned.'),
    ).toBeInTheDocument();
  });

  it('renders team detail API error', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    getTeams.mockResolvedValue([
      {
        id: 'team-1',
        organizationId: 'org-1',
        name: 'North Team',
      },
    ]);

    getTeam.mockRejectedValue(new Error('Team not found.'));

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(screen.getByRole('button', { name: /View details/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Team not found.',
    );
  });

  it('shows validation error when team name is blank', async () => {
    setStoredUser('admin');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderSettings(['/settings']);

    await screen.findByText('Organization Settings');

    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Team name is required.',
    );
    expect(createTeam).not.toHaveBeenCalled();
  });

  it('shows API error when team creation fails', async () => {
    setStoredUser('manager');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    createTeam.mockRejectedValue(new Error('Invalid request data.'));

    renderSettings(['/settings']);

    await screen.findByText('Organization Settings');

    fireEvent.change(screen.getByLabelText('Team name'), {
      target: { value: 'North Knoxville' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid request data.',
    );
  });

  it('renders representative without team create access', async () => {
    setStoredUser('rep');

    getOrganization.mockResolvedValue({
      id: 'org-1',
      name: 'Org Name',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderSettings(['/settings']);

    const teamInput = await screen.findByLabelText('Team name');

    expect(teamInput).toBeDisabled();
    expect(
      screen.getByText('Only managers and administrators can view teams.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Only managers and administrators can create teams.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create team' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add member' }),
    ).not.toBeInTheDocument();
  });

  it('renders API load error', async () => {
    setStoredUser('admin');
    getOrganization.mockRejectedValue(new Error('Invalid or expired token.'));

    renderSettings(['/settings']);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid or expired token.',
    );
  });
});
