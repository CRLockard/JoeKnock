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
import { getOrganization, updateOrganization } from '../api/organizationApi.js';
import { createTeam, getTeam, getTeams } from '../api/teamsApi.js';

vi.mock('../api/organizationApi.js', () => ({
  getOrganization: vi.fn(),
  updateOrganization: vi.fn(),
}));

vi.mock('../api/teamsApi.js', () => ({
  createTeam: vi.fn(),
  getTeam: vi.fn(),
  getTeams: vi.fn(),
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
  getTeams.mockResolvedValue([]);
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

    renderSettings(['/settings']);

    expect(await screen.findByText('Alpha Team')).toBeInTheDocument();
    expect(screen.getByText('Beta Team')).toBeInTheDocument();
    expect(getTeams).toHaveBeenCalledTimes(1);
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

    renderSettings(['/settings']);

    await screen.findByText('North Team');
    fireEvent.click(screen.getByRole('button', { name: 'View details' }));

    await waitFor(() => {
      expect(getTeam).toHaveBeenCalledWith('team-1');
    });

    expect(
      await screen.findByText('Ana Able (ana@example.com) - rep'),
    ).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'View details' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'View details' }));

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
