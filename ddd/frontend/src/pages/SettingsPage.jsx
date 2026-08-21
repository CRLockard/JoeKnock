import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { useAuth } from '../auth/useAuth.js';
import { SettingsWorkspace } from '../components/SettingsWorkspace.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';

const REP_VISIBILITY_OPTIONS = [
  {
    value: 'own',
    label: 'Self',
    description: 'Reps can see only their own interactions.',
  },
  {
    value: 'team',
    label: 'Team',
    description:
      'Reps can see interactions belonging to members of their assigned teams.',
  },
  {
    value: 'organization',
    label: 'Organization',
    description: 'Reps can see all interactions in the organization.',
  },
];

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
];

export function SettingsPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const [organization, setOrganization] = useState(null);
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teams, setTeams] = useState([]);
  const [organizationUsers, setOrganizationUsers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [teamError, setTeamError] = useState('');
  const [teamSuccessMessage, setTeamSuccessMessage] = useState('');
  const [teamsError, setTeamsError] = useState('');
  const [usersError, setUsersError] = useState('');
  const [teamDetailError, setTeamDetailError] = useState('');
  const [addMemberError, setAddMemberError] = useState('');
  const [addMemberSuccessMessage, setAddMemberSuccessMessage] = useState('');
  const [removeMemberError, setRemoveMemberError] = useState('');
  const [removeMemberSuccessMessage, setRemoveMemberSuccessMessage] =
    useState('');
  const [statusesError, setStatusesError] = useState('');
  const [statusesSuccessMessage, setStatusesSuccessMessage] = useState('');
  const [statusName, setStatusName] = useState('');
  const [statusDescription, setStatusDescription] = useState('');
  const [editingStatusId, setEditingStatusId] = useState('');
  const [editStatusName, setEditStatusName] = useState('');
  const [editStatusDescription, setEditStatusDescription] = useState('');
  const [editStatusDisplayOrder, setEditStatusDisplayOrder] = useState('');
  const [draggedStatusId, setDraggedStatusId] = useState('');
  const [dragOverStatusId, setDragOverStatusId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isTeamsLoading, setIsTeamsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [isTeamDetailLoading, setIsTeamDetailLoading] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isStatusesLoading, setIsStatusesLoading] = useState(true);
  const [isCreatingStatus, setIsCreatingStatus] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeactivatingStatus, setIsDeactivatingStatus] = useState(false);
  const [isReorderingStatuses, setIsReorderingStatuses] = useState(false);
  const [organizationSettings, setOrganizationSettings] = useState(null);
  const [repVisibility, setRepVisibility] = useState('own');
  const [timezone, setTimezone] = useState('UTC');
  const [organizationSettingsError, setOrganizationSettingsError] =
    useState('');
  const [
    organizationSettingsSuccessMessage,
    setOrganizationSettingsSuccessMessage,
  ] = useState('');
  const [isSavingOrganizationSettings, setIsSavingOrganizationSettings] =
    useState(false);

  const isAdmin = auth.user?.role === 'admin';
  // Managers share most operational settings work with admins, but only admins
  // can apply org-wide writes for security-sensitive fields.
  const canViewTeams = isAdmin || auth.user?.role === 'manager';
  const canCreateTeams = canViewTeams;
  const canManageStatuses = canViewTeams;
  const canViewOrganizationSettings = canViewTeams;
  const activeSection =
    searchParams.get('section') &&
    ['company', 'teams', 'statuses', 'visibility'].includes(
      searchParams.get('section'),
    )
      ? searchParams.get('section')
      : 'all';

  useEffect(() => {
    if (!canViewOrganizationSettings) {
      setOrganizationSettings(null);
      setOrganizationSettingsError('');
      setOrganizationSettingsSuccessMessage('');
      return;
    }

    let isMounted = true;

    async function loadOrganizationSettings() {
      setOrganizationSettingsError('');

      try {
        const response = await getOrganizationSettings();

        if (!isMounted) {
          return;
        }

        setOrganizationSettings(response);
        // Keep editable controls synchronized with server state so users can
        // switch sections without losing authoritative current values.
        setRepVisibility(response.repVisibility);
        setTimezone(response.timezone);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setOrganizationSettingsError(
          loadError.message ||
            'Unable to load organization visibility settings.',
        );
      }
    }

    void loadOrganizationSettings();

    return () => {
      isMounted = false;
    };
  }, [canViewOrganizationSettings]);

  useEffect(() => {
    let isMounted = true;

    async function loadOrganization() {
      try {
        const response = await getOrganization();

        if (!isMounted) {
          return;
        }

        setOrganization(response);
        setName(response.name);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError.message || 'Unable to load organization settings.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOrganization();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!canViewTeams) {
      // Explicitly reset subordinate workspace state when role gates close to
      // prevent stale team/user/status data from prior privileged sessions.
      setTeams([]);
      setSelectedTeam(null);
      setTeamsError('');
      setUsersError('');
      setTeamDetailError('');
      setAddMemberError('');
      setAddMemberSuccessMessage('');
      setRemoveMemberError('');
      setRemoveMemberSuccessMessage('');
      setStatusesError('');
      setStatusesSuccessMessage('');
      setOrganizationUsers([]);
      setStatuses([]);
      setSelectedUserId('');
      setIsTeamsLoading(false);
      setIsUsersLoading(false);
      setIsTeamDetailLoading(false);
      setIsStatusesLoading(false);
      return;
    }

    let isMounted = true;

    async function loadTeams() {
      setTeamsError('');
      setIsTeamsLoading(true);

      try {
        const response = await getTeams();

        if (!isMounted) {
          return;
        }

        setTeams(response);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setTeamsError(loadError.message || 'Unable to load teams.');
      } finally {
        if (isMounted) {
          setIsTeamsLoading(false);
        }
      }
    }

    loadTeams();

    return () => {
      isMounted = false;
    };
  }, [canViewTeams]);

  useEffect(() => {
    if (activeSection !== 'all' && activeSection !== 'statuses') {
      setStatusesSuccessMessage('');
    }
  }, [activeSection]);

  useEffect(() => {
    let isMounted = true;

    async function loadStatuses() {
      setStatusesError('');
      setIsStatusesLoading(true);

      try {
        const response = await getStatuses();

        if (!isMounted) {
          return;
        }

        setStatuses(response);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setStatusesError(loadError.message || 'Unable to load statuses.');
      } finally {
        if (isMounted) {
          setIsStatusesLoading(false);
        }
      }
    }

    loadStatuses();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!canViewTeams) {
      return;
    }

    let isMounted = true;

    async function loadOrganizationUsers() {
      setUsersError('');
      setIsUsersLoading(true);

      try {
        const response = await getUsers();

        if (!isMounted) {
          return;
        }

        setOrganizationUsers(response);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setUsersError(loadError.message || 'Unable to load users.');
      } finally {
        if (isMounted) {
          setIsUsersLoading(false);
        }
      }
    }

    loadOrganizationUsers();

    return () => {
      isMounted = false;
    };
  }, [canViewTeams]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Organization name is required.');
      return;
    }

    setIsSaving(true);

    try {
      const updated = await updateOrganization({ name: trimmedName });
      setOrganization(updated);
      setName(updated.name);
      setSuccessMessage('Organization updated successfully.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to update organization.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateTeam(event) {
    event.preventDefault();
    setTeamError('');
    setTeamSuccessMessage('');

    if (!canCreateTeams) {
      setTeamError('Only managers and administrators can create teams.');
      return;
    }

    const trimmedName = teamName.trim();

    if (!trimmedName) {
      setTeamError('Team name is required.');
      return;
    }

    setIsCreatingTeam(true);

    try {
      const created = await createTeam({ name: trimmedName });
      setTeamName('');
      setTeamSuccessMessage(`Created team ${created.name}.`);
      setTeams((previousTeams) =>
        [...previousTeams, created].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
    } catch (createError) {
      setTeamError(createError.message || 'Unable to create team.');
    } finally {
      setIsCreatingTeam(false);
    }
  }

  async function handleViewTeam(teamId) {
    setAddMemberError('');
    setAddMemberSuccessMessage('');
    setRemoveMemberError('');
    setRemoveMemberSuccessMessage('');
    setSelectedUserId('');
    setTeamDetailError('');
    setSelectedTeam(null);
    setIsTeamDetailLoading(true);

    try {
      const response = await getTeam(teamId);
      setSelectedTeam(response);
    } catch (loadError) {
      setTeamDetailError(loadError.message || 'Unable to load team details.');
    } finally {
      setIsTeamDetailLoading(false);
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();
    setAddMemberError('');
    setAddMemberSuccessMessage('');
    setRemoveMemberError('');
    setRemoveMemberSuccessMessage('');

    if (!canViewTeams) {
      setAddMemberError(
        'Only managers and administrators can add users to teams.',
      );
      return;
    }

    if (!selectedTeam) {
      setAddMemberError('Select a team before adding a member.');
      return;
    }

    if (!selectedUserId) {
      setAddMemberError('User selection is required.');
      return;
    }

    setIsAddingMember(true);

    try {
      await addUserToTeam(selectedTeam.id, { userId: selectedUserId });
      const refreshedTeam = await getTeam(selectedTeam.id);
      setSelectedTeam(refreshedTeam);
      setSelectedUserId('');
      setAddMemberSuccessMessage('Team member added successfully.');
    } catch (addError) {
      setAddMemberError(addError.message || 'Unable to add team member.');
    } finally {
      setIsAddingMember(false);
    }
  }

  async function handleRemoveMember(member) {
    setRemoveMemberError('');
    setRemoveMemberSuccessMessage('');
    setAddMemberError('');
    setAddMemberSuccessMessage('');

    if (!canViewTeams) {
      setRemoveMemberError(
        'Only managers and administrators can remove users from teams.',
      );
      return;
    }

    if (!selectedTeam) {
      setRemoveMemberError('Select a team before removing a member.');
      return;
    }

    const shouldRemove = window.confirm(
      `Remove ${member.firstName} ${member.lastName} from ${selectedTeam.name}?`,
    );

    if (!shouldRemove) {
      return;
    }

    setIsRemovingMember(true);

    try {
      await removeUserFromTeam(selectedTeam.id, member.id);
      const refreshedTeam = await getTeam(selectedTeam.id);
      setSelectedTeam(refreshedTeam);
      setRemoveMemberSuccessMessage('Team member removed successfully.');
    } catch (removeError) {
      setRemoveMemberError(
        removeError.message || 'Unable to remove team member.',
      );
    } finally {
      setIsRemovingMember(false);
    }
  }

  function startEditingStatus(status) {
    setEditingStatusId(status.id);
    setEditStatusName(status.name);
    setEditStatusDescription(status.description ?? '');
    setEditStatusDisplayOrder(String(status.displayOrder));
    setStatusesError('');
    setStatusesSuccessMessage('');
  }

  function cancelEditingStatus() {
    setEditingStatusId('');
    setEditStatusName('');
    setEditStatusDescription('');
    setEditStatusDisplayOrder('');
  }

  async function reloadStatuses() {
    const response = await getStatuses();
    setStatuses(response);
  }

  async function persistStatusOrder(nextStatuses) {
    const updates = nextStatuses.map((status, index) => {
      return updateStatus(status.id, {
        displayOrder: index + 1,
      });
    });

    await Promise.all(updates);
    await reloadStatuses();
  }

  async function handleCreateStatus(event) {
    event.preventDefault();
    setStatusesError('');
    setStatusesSuccessMessage('');

    if (!canManageStatuses) {
      setStatusesError('Only managers and administrators can create statuses.');
      return;
    }

    const trimmedName = statusName.trim();

    if (!trimmedName) {
      setStatusesError('Status name is required.');
      return;
    }

    setIsCreatingStatus(true);

    try {
      await createStatus({
        name: trimmedName,
        description: statusDescription,
      });

      await reloadStatuses();
      setStatusName('');
      setStatusDescription('');
      setStatusesSuccessMessage('Status created successfully.');
    } catch (createError) {
      setStatusesError(createError.message || 'Unable to create status.');
    } finally {
      setIsCreatingStatus(false);
    }
  }

  async function handleStatusDrop(targetStatusId) {
    if (
      !canManageStatuses ||
      !draggedStatusId ||
      draggedStatusId === targetStatusId
    ) {
      setDraggedStatusId('');
      setDragOverStatusId('');
      return;
    }

    const sourceIndex = statuses.findIndex(
      (status) => status.id === draggedStatusId,
    );
    const targetIndex = statuses.findIndex(
      (status) => status.id === targetStatusId,
    );

    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggedStatusId('');
      setDragOverStatusId('');
      return;
    }

    const nextStatuses = [...statuses];
    const [moved] = nextStatuses.splice(sourceIndex, 1);
    nextStatuses.splice(targetIndex, 0, moved);

    setStatuses(nextStatuses);
    setDraggedStatusId('');
    setDragOverStatusId('');
    setIsReorderingStatuses(true);
    setStatusesError('');
    setStatusesSuccessMessage('');

    try {
      await persistStatusOrder(nextStatuses);
      setStatusesSuccessMessage('Status order updated successfully.');
    } catch (error) {
      setStatusesError(error.message || 'Unable to update status order.');
      await reloadStatuses();
    } finally {
      setIsReorderingStatuses(false);
    }
  }

  async function handleUpdateStatus(event) {
    event.preventDefault();
    setStatusesError('');
    setStatusesSuccessMessage('');

    if (!canManageStatuses) {
      setStatusesError('Only managers and administrators can update statuses.');
      return;
    }

    if (!editingStatusId) {
      setStatusesError('No status selected for update.');
      return;
    }

    const trimmedName = editStatusName.trim();
    const normalizedDisplayOrder = Number(editStatusDisplayOrder);

    if (!trimmedName) {
      setStatusesError('Status name is required.');
      return;
    }

    if (
      !Number.isInteger(normalizedDisplayOrder) ||
      normalizedDisplayOrder < 1
    ) {
      setStatusesError('Display order must be a positive integer.');
      return;
    }

    setIsUpdatingStatus(true);

    try {
      await updateStatus(editingStatusId, {
        name: trimmedName,
        description: editStatusDescription,
        displayOrder: normalizedDisplayOrder,
      });

      await reloadStatuses();
      cancelEditingStatus();
      setStatusesSuccessMessage('Status updated successfully.');
    } catch (updateError) {
      setStatusesError(updateError.message || 'Unable to update status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleDeactivateStatus(status) {
    setStatusesError('');
    setStatusesSuccessMessage('');

    if (!canManageStatuses) {
      setStatusesError(
        'Only managers and administrators can deactivate statuses.',
      );
      return;
    }

    const shouldDeactivate = window.confirm(
      `Deactivate status ${status.name}?`,
    );

    if (!shouldDeactivate) {
      return;
    }

    setIsDeactivatingStatus(true);

    try {
      await setStatusActive(status.id, false);
      await reloadStatuses();
      if (editingStatusId === status.id) {
        cancelEditingStatus();
      }
      setStatusesSuccessMessage('Status deactivated successfully.');
    } catch (deactivateError) {
      setStatusesError(
        deactivateError.message || 'Unable to deactivate status.',
      );
    } finally {
      setIsDeactivatingStatus(false);
    }
  }

  async function handleOrganizationSettingsSubmit(event) {
    event.preventDefault();
    setOrganizationSettingsError('');
    setOrganizationSettingsSuccessMessage('');

    if (!isAdmin) {
      setOrganizationSettingsError(
        'Only administrators can update organization visibility settings.',
      );
      return;
    }

    setIsSavingOrganizationSettings(true);

    try {
      const updated = await updateOrganizationSettings({
        rep_visibility: repVisibility,
        timezone,
      });

      setOrganizationSettings(updated);
      setRepVisibility(updated.repVisibility);
      setTimezone(updated.timezone);
      setOrganizationSettingsSuccessMessage(
        'Visibility settings updated successfully.',
      );
    } catch (saveError) {
      setOrganizationSettingsError(
        saveError.message || 'Unable to update visibility settings.',
      );
    } finally {
      setIsSavingOrganizationSettings(false);
    }
  }

  return (
    <SettingsWorkspace
      title="Organization Settings"
      description="Manage company details, teams, statuses, and visibility rules."
      activeSection={activeSection === 'all' ? 'company' : activeSection}
    >
      {isLoading ? <p className="feedback">Loading organization...</p> : null}
      {error ? (
        <p role="alert" className="feedback feedback--error">
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p role="status" className="feedback feedback--success">
          {successMessage}
        </p>
      ) : null}
      {teamError ? (
        <p role="alert" className="feedback feedback--error">
          {teamError}
        </p>
      ) : null}
      {teamSuccessMessage ? (
        <p role="status" className="feedback feedback--success">
          {teamSuccessMessage}
        </p>
      ) : null}
      {teamsError ? (
        <p role="alert" className="feedback feedback--error">
          {teamsError}
        </p>
      ) : null}
      {usersError ? (
        <p role="alert" className="feedback feedback--error">
          {usersError}
        </p>
      ) : null}
      {teamDetailError ? (
        <p role="alert" className="feedback feedback--error">
          {teamDetailError}
        </p>
      ) : null}
      {addMemberError ? (
        <p role="alert" className="feedback feedback--error">
          {addMemberError}
        </p>
      ) : null}
      {addMemberSuccessMessage ? (
        <p role="status" className="feedback feedback--success">
          {addMemberSuccessMessage}
        </p>
      ) : null}
      {removeMemberError ? (
        <p role="alert" className="feedback feedback--error">
          {removeMemberError}
        </p>
      ) : null}
      {removeMemberSuccessMessage ? (
        <p role="status" className="feedback feedback--success">
          {removeMemberSuccessMessage}
        </p>
      ) : null}
      {statusesError ? (
        <p role="alert" className="feedback feedback--error">
          {statusesError}
        </p>
      ) : null}
      {statusesSuccessMessage ? (
        activeSection === 'all' || activeSection === 'statuses' ? (
          <p role="status" className="feedback feedback--success">
            {statusesSuccessMessage}
          </p>
        ) : null
      ) : null}
      {organizationSettingsError ? (
        <p role="alert" className="feedback feedback--error">
          {organizationSettingsError}
        </p>
      ) : null}
      {organizationSettingsSuccessMessage ? (
        <p role="status" className="feedback feedback--success">
          {organizationSettingsSuccessMessage}
        </p>
      ) : null}

      {!isLoading && organization ? (
        <>
          {activeSection === 'all' || activeSection === 'company' ? (
            <div className="workspace-grid">
              <form onSubmit={handleSubmit} className="panel stack-form">
                <div className="panel__header">
                  <h3>Company Information</h3>
                </div>

                <label className="form-field" htmlFor="organization-name">
                  <span>Organization name</span>
                  <input
                    id="organization-name"
                    name="organizationName"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={!isAdmin || isSaving}
                  />
                </label>

                {isAdmin ? (
                  <button
                    type="submit"
                    className="button button--primary"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save organization'}
                  </button>
                ) : (
                  <p className="feedback">
                    Only administrators can update organization information.
                  </p>
                )}
              </form>
            </div>
          ) : null}

          {activeSection === 'all' || activeSection === 'teams' ? (
            <div className="workspace-grid workspace-grid--teams">
              <section aria-label="view teams" className="panel">
                <div className="panel__header">
                  <h3>Teams</h3>
                </div>

                {!canViewTeams ? (
                  <p className="feedback">
                    Only managers and administrators can view teams.
                  </p>
                ) : null}
                {canViewTeams && isTeamsLoading ? (
                  <p className="feedback">Loading teams...</p>
                ) : null}
                {canViewTeams && isUsersLoading ? (
                  <p className="feedback">Loading users...</p>
                ) : null}
                {canViewTeams && !isTeamsLoading && teams.length === 0 ? (
                  <p className="feedback">No teams found.</p>
                ) : null}

                {canViewTeams && !isTeamsLoading && teams.length > 0 ? (
                  <div className="team-card-list">
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        className="team-card"
                        onClick={() => handleViewTeam(team.id)}
                        disabled={isTeamDetailLoading}
                      >
                        <strong>{team.name}</strong>
                        <span>View details</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>

              <aside className="workspace-side-panel">
                <section aria-label="create team" className="panel stack-form">
                  <div className="panel__header">
                    <h3>Create Team</h3>
                  </div>
                  <form onSubmit={handleCreateTeam} className="stack-form">
                    <label className="form-field" htmlFor="team-name">
                      <span>Team name</span>
                      <input
                        id="team-name"
                        name="teamName"
                        type="text"
                        value={teamName}
                        onChange={(event) => setTeamName(event.target.value)}
                        disabled={!canCreateTeams || isCreatingTeam}
                      />
                    </label>

                    {canCreateTeams ? (
                      <button
                        type="submit"
                        className="button button--primary"
                        disabled={isCreatingTeam}
                      >
                        {isCreatingTeam ? 'Creating team...' : 'Create team'}
                      </button>
                    ) : (
                      <p className="feedback">
                        Only managers and administrators can create teams.
                      </p>
                    )}
                  </form>
                </section>

                {canViewTeams && isTeamDetailLoading ? (
                  <p className="feedback">Loading team details...</p>
                ) : null}

                {selectedTeam ? (
                  <section
                    aria-label="team detail"
                    className="panel stack-form"
                  >
                    <div className="panel__header">
                      <h3>{selectedTeam.name}</h3>
                      <StatusBadge tone="info">
                        {selectedTeam.members.length} Members
                      </StatusBadge>
                    </div>

                    {selectedTeam.members.length === 0 ? (
                      <p className="feedback">No team members assigned.</p>
                    ) : (
                      <div className="member-list">
                        {selectedTeam.members.map((member) => (
                          <div key={member.id} className="member-list__item">
                            <div>
                              <strong>
                                {member.firstName} {member.lastName}
                              </strong>
                              <span>
                                {member.firstName} {member.lastName} (
                                {member.email}) - {member.role}
                              </span>
                            </div>
                            <div className="member-list__actions">
                              <StatusBadge tone="info">
                                {member.role}
                              </StatusBadge>
                              <button
                                type="button"
                                className="button button--ghost"
                                onClick={() => handleRemoveMember(member)}
                                disabled={isRemovingMember || isAddingMember}
                              >
                                {isRemovingMember
                                  ? 'Removing member...'
                                  : `Remove ${member.firstName} ${member.lastName}`}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      onSubmit={handleAddMember}
                      aria-label="add team member"
                      className="stack-form"
                    >
                      <label className="form-field" htmlFor="team-member-user">
                        <span>Team member</span>
                        <select
                          id="team-member-user"
                          name="teamMemberUser"
                          value={selectedUserId}
                          onChange={(event) =>
                            setSelectedUserId(event.target.value)
                          }
                          disabled={isAddingMember || isUsersLoading}
                        >
                          <option value="">Select a user</option>
                          {organizationUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.firstName} {user.lastName} ({user.email})
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="submit"
                        className="button button--primary"
                        disabled={isAddingMember || isUsersLoading}
                      >
                        {isAddingMember ? 'Adding member...' : 'Add member'}
                      </button>
                    </form>
                  </section>
                ) : null}
              </aside>
            </div>
          ) : null}

          {activeSection === 'all' || activeSection === 'statuses' ? (
            <div className="workspace-grid workspace-grid--statuses">
              <section
                aria-label="manage statuses"
                className="panel panel--table"
              >
                <div className="panel__header">
                  <h3>Statuses</h3>
                </div>

                {isStatusesLoading ? (
                  <p className="feedback">Loading statuses...</p>
                ) : null}
                {!isStatusesLoading && statuses.length === 0 ? (
                  <p className="feedback">No active statuses found.</p>
                ) : null}

                {!isStatusesLoading && statuses.length > 0 ? (
                  <>
                    <p className="feedback status-order-hint">
                      Drag and drop to reorder statuses
                    </p>
                    <div className="table-shell">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col" aria-label="Drag handle" />
                          <th scope="col">Order</th>
                          <th scope="col">Status Name</th>
                          <th scope="col">Description</th>
                          <th scope="col">Active</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statuses.map((status) => (
                          <tr
                            key={status.id}
                            className={`status-order-row${draggedStatusId === status.id ? ' status-order-row--dragging' : ''}${
                              dragOverStatusId === status.id
                                ? ' status-order-row--drop-target'
                                : ''
                            }`}
                            draggable={
                              canManageStatuses && !isReorderingStatuses
                            }
                            onDragStart={() => {
                              setDraggedStatusId(status.id);
                              setDragOverStatusId('');
                            }}
                            onDragEnd={() => {
                              setDraggedStatusId('');
                              setDragOverStatusId('');
                            }}
                            onDragOver={(event) => {
                              if (canManageStatuses) {
                                event.preventDefault();
                                setDragOverStatusId(status.id);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverStatusId === status.id) {
                                setDragOverStatusId('');
                              }
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              void handleStatusDrop(status.id);
                            }}
                          >
                            <td>
                              <span
                                aria-hidden="true"
                                className="status-order-handle"
                              >
                                ⋮⋮
                              </span>
                              <span className="visually-hidden">
                                Drag to reorder {status.name}
                              </span>
                            </td>
                            <td>{status.displayOrder}</td>
                            <td>
                              {status.name}
                              {status.description
                                ? ` - ${status.description}`
                                : ''}
                            </td>
                            <td>{status.description || 'No description'}</td>
                            <td>
                              <StatusBadge
                                tone={
                                  status.isActive === false
                                    ? 'muted'
                                    : 'success'
                                }
                              >
                                {status.isActive === false
                                  ? 'Inactive'
                                  : 'Active'}
                              </StatusBadge>
                            </td>
                            <td>
                              <div className="table-actions">
                                {canManageStatuses ? (
                                  <>
                                    <button
                                      type="button"
                                      className="button button--ghost"
                                      onClick={() => startEditingStatus(status)}
                                      disabled={
                                        isUpdatingStatus ||
                                        isDeactivatingStatus ||
                                        isReorderingStatuses
                                      }
                                    >
                                      Edit {status.name}
                                    </button>
                                    <button
                                      type="button"
                                      className="button button--ghost"
                                      onClick={() =>
                                        handleDeactivateStatus(status)
                                      }
                                      disabled={
                                        isDeactivatingStatus ||
                                        isUpdatingStatus ||
                                        isReorderingStatuses
                                      }
                                    >
                                      {isDeactivatingStatus
                                        ? 'Deactivating...'
                                        : `Deactivate ${status.name}`}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </>
                ) : null}
              </section>

              <aside className="workspace-side-panel">
                {canManageStatuses ? (
                  <form
                    onSubmit={handleCreateStatus}
                    aria-label="create status"
                    className="panel stack-form"
                  >
                    <div className="panel__header">
                      <h3>Add Status</h3>
                    </div>

                    <label className="form-field" htmlFor="status-name">
                      <span>Status name</span>
                      <input
                        id="status-name"
                        name="statusName"
                        type="text"
                        value={statusName}
                        onChange={(event) => setStatusName(event.target.value)}
                        disabled={isCreatingStatus}
                      />
                    </label>

                    <label className="form-field" htmlFor="status-description">
                      <span>Status description</span>
                      <input
                        id="status-description"
                        name="statusDescription"
                        type="text"
                        value={statusDescription}
                        onChange={(event) =>
                          setStatusDescription(event.target.value)
                        }
                        disabled={isCreatingStatus}
                      />
                    </label>

                    <button
                      type="submit"
                      className="button button--primary"
                      disabled={isCreatingStatus}
                    >
                      {isCreatingStatus
                        ? 'Creating status...'
                        : 'Create status'}
                    </button>
                  </form>
                ) : (
                  <p className="feedback">
                    Only managers and administrators can manage statuses.
                  </p>
                )}

                {editingStatusId ? (
                  <form
                    onSubmit={handleUpdateStatus}
                    aria-label="edit status"
                    className="panel stack-form"
                  >
                    <div className="panel__header">
                      <h3>Edit Status</h3>
                    </div>

                    <label className="form-field" htmlFor="edit-status-name">
                      <span>Edit status name</span>
                      <input
                        id="edit-status-name"
                        name="editStatusName"
                        type="text"
                        value={editStatusName}
                        onChange={(event) =>
                          setEditStatusName(event.target.value)
                        }
                        disabled={isUpdatingStatus}
                      />
                    </label>

                    <label
                      className="form-field"
                      htmlFor="edit-status-description"
                    >
                      <span>Edit status description</span>
                      <input
                        id="edit-status-description"
                        name="editStatusDescription"
                        type="text"
                        value={editStatusDescription}
                        onChange={(event) =>
                          setEditStatusDescription(event.target.value)
                        }
                        disabled={isUpdatingStatus}
                      />
                    </label>

                    <label
                      className="form-field"
                      htmlFor="edit-status-display-order"
                    >
                      <span>Edit display order</span>
                      <input
                        id="edit-status-display-order"
                        name="editStatusDisplayOrder"
                        type="number"
                        min="1"
                        value={editStatusDisplayOrder}
                        onChange={(event) =>
                          setEditStatusDisplayOrder(event.target.value)
                        }
                        disabled={isUpdatingStatus || isReorderingStatuses}
                      />
                    </label>

                    <div className="form-actions">
                      <button
                        type="submit"
                        className="button button--primary"
                        disabled={isUpdatingStatus}
                      >
                        {isUpdatingStatus ? 'Saving status...' : 'Save status'}
                      </button>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={cancelEditingStatus}
                        disabled={isUpdatingStatus}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </aside>
            </div>
          ) : null}

          {activeSection === 'all' || activeSection === 'visibility' ? (
            <div className="workspace-grid workspace-grid--visibility">
              <form
                onSubmit={handleOrganizationSettingsSubmit}
                className="panel stack-form"
              >
                <div className="panel__header">
                  <h3>Visibility Settings</h3>
                </div>

                {canViewOrganizationSettings ? (
                  <>
                    <fieldset className="radio-group">
                      <legend>Representative Visibility</legend>
                      {REP_VISIBILITY_OPTIONS.map((option) => (
                        <label key={option.value} className="radio-card">
                          <input
                            type="radio"
                            name="repVisibility"
                            value={option.value}
                            checked={repVisibility === option.value}
                            onChange={(event) =>
                              setRepVisibility(event.target.value)
                            }
                            disabled={!isAdmin || isSavingOrganizationSettings}
                          />
                          <span>
                            <strong>{option.label}</strong>
                            <small>{option.description}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>

                    <label
                      className="form-field"
                      htmlFor="organization-timezone"
                    >
                      <span>Timezone</span>
                      <select
                        id="organization-timezone"
                        value={timezone}
                        onChange={(event) => setTimezone(event.target.value)}
                        disabled={!isAdmin || isSavingOrganizationSettings}
                      >
                        {TIMEZONE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    {isAdmin ? (
                      <button
                        type="submit"
                        className="button button--primary"
                        disabled={isSavingOrganizationSettings}
                      >
                        {isSavingOrganizationSettings
                          ? 'Saving settings...'
                          : 'Save Changes'}
                      </button>
                    ) : (
                      <p className="feedback">
                        Only administrators can update visibility settings.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="feedback">
                    Visibility settings are available to managers and
                    administrators.
                  </p>
                )}
              </form>
            </div>
          ) : null}
        </>
      ) : null}
    </SettingsWorkspace>
  );
}
