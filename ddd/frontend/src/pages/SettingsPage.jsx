import { useEffect, useState } from 'react';
import { getOrganization, updateOrganization } from '../api/organizationApi.js';
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

export function SettingsPage() {
  const auth = useAuth();
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
  const [statusDisplayOrder, setStatusDisplayOrder] = useState('');
  const [editingStatusId, setEditingStatusId] = useState('');
  const [editStatusName, setEditStatusName] = useState('');
  const [editStatusDescription, setEditStatusDescription] = useState('');
  const [editStatusDisplayOrder, setEditStatusDisplayOrder] = useState('');
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

  const isAdmin = auth.user?.role === 'admin';
  const canViewTeams = isAdmin || auth.user?.role === 'manager';
  const canCreateTeams = canViewTeams;
  const canManageStatuses = canViewTeams;

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

  async function handleCreateStatus(event) {
    event.preventDefault();
    setStatusesError('');
    setStatusesSuccessMessage('');

    if (!canManageStatuses) {
      setStatusesError('Only managers and administrators can create statuses.');
      return;
    }

    const trimmedName = statusName.trim();
    const normalizedDisplayOrder = Number(statusDisplayOrder);

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

    setIsCreatingStatus(true);

    try {
      await createStatus({
        name: trimmedName,
        description: statusDescription,
        displayOrder: normalizedDisplayOrder,
      });

      await reloadStatuses();
      setStatusName('');
      setStatusDescription('');
      setStatusDisplayOrder('');
      setStatusesSuccessMessage('Status created successfully.');
    } catch (createError) {
      setStatusesError(createError.message || 'Unable to create status.');
    } finally {
      setIsCreatingStatus(false);
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

  return (
    <section>
      <h2>Organization Settings</h2>
      {isLoading ? <p>Loading organization...</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {successMessage ? <p role="status">{successMessage}</p> : null}
      {teamError ? <p role="alert">{teamError}</p> : null}
      {teamSuccessMessage ? <p role="status">{teamSuccessMessage}</p> : null}
      {teamsError ? <p role="alert">{teamsError}</p> : null}
      {usersError ? <p role="alert">{usersError}</p> : null}
      {teamDetailError ? <p role="alert">{teamDetailError}</p> : null}
      {addMemberError ? <p role="alert">{addMemberError}</p> : null}
      {addMemberSuccessMessage ? (
        <p role="status">{addMemberSuccessMessage}</p>
      ) : null}
      {removeMemberError ? <p role="alert">{removeMemberError}</p> : null}
      {removeMemberSuccessMessage ? (
        <p role="status">{removeMemberSuccessMessage}</p>
      ) : null}
      {statusesError ? <p role="alert">{statusesError}</p> : null}
      {statusesSuccessMessage ? (
        <p role="status">{statusesSuccessMessage}</p>
      ) : null}

      {!isLoading && organization ? (
        <>
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="organization-name">Organization name</label>
              <input
                id="organization-name"
                name="organizationName"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!isAdmin || isSaving}
              />
            </div>

            {isAdmin ? (
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save organization'}
              </button>
            ) : (
              <p>Only administrators can update organization information.</p>
            )}
          </form>

          <section aria-label="create team">
            <h3>Create Team</h3>
            <form onSubmit={handleCreateTeam}>
              <div>
                <label htmlFor="team-name">Team name</label>
                <input
                  id="team-name"
                  name="teamName"
                  type="text"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  disabled={!canCreateTeams || isCreatingTeam}
                />
              </div>

              {canCreateTeams ? (
                <button type="submit" disabled={isCreatingTeam}>
                  {isCreatingTeam ? 'Creating team...' : 'Create team'}
                </button>
              ) : (
                <p>Only managers and administrators can create teams.</p>
              )}
            </form>
          </section>

          <section aria-label="manage statuses">
            <h3>Statuses</h3>

            {isStatusesLoading ? <p>Loading statuses...</p> : null}

            {!isStatusesLoading && statuses.length === 0 ? (
              <p>No active statuses found.</p>
            ) : null}

            {!isStatusesLoading && statuses.length > 0 ? (
              <ul>
                {statuses.map((status) => (
                  <li key={status.id}>
                    {status.name} (order: {status.displayOrder})
                    {status.description ? ` - ${status.description}` : ''}{' '}
                    {canManageStatuses ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditingStatus(status)}
                          disabled={isUpdatingStatus || isDeactivatingStatus}
                        >
                          Edit {status.name}
                        </button>{' '}
                        <button
                          type="button"
                          onClick={() => handleDeactivateStatus(status)}
                          disabled={isDeactivatingStatus || isUpdatingStatus}
                        >
                          {isDeactivatingStatus
                            ? 'Deactivating...'
                            : `Deactivate ${status.name}`}
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {canManageStatuses ? (
              <form onSubmit={handleCreateStatus} aria-label="create status">
                <h4>Create Status</h4>

                <label htmlFor="status-name">Status name</label>
                <input
                  id="status-name"
                  name="statusName"
                  type="text"
                  value={statusName}
                  onChange={(event) => setStatusName(event.target.value)}
                  disabled={isCreatingStatus}
                />

                <label htmlFor="status-description">Status description</label>
                <input
                  id="status-description"
                  name="statusDescription"
                  type="text"
                  value={statusDescription}
                  onChange={(event) => setStatusDescription(event.target.value)}
                  disabled={isCreatingStatus}
                />

                <label htmlFor="status-display-order">Display order</label>
                <input
                  id="status-display-order"
                  name="statusDisplayOrder"
                  type="number"
                  min="1"
                  value={statusDisplayOrder}
                  onChange={(event) =>
                    setStatusDisplayOrder(event.target.value)
                  }
                  disabled={isCreatingStatus}
                />

                <button type="submit" disabled={isCreatingStatus}>
                  {isCreatingStatus ? 'Creating status...' : 'Create status'}
                </button>
              </form>
            ) : (
              <p>Only managers and administrators can manage statuses.</p>
            )}

            {editingStatusId ? (
              <form onSubmit={handleUpdateStatus} aria-label="edit status">
                <h4>Edit Status</h4>

                <label htmlFor="edit-status-name">Edit status name</label>
                <input
                  id="edit-status-name"
                  name="editStatusName"
                  type="text"
                  value={editStatusName}
                  onChange={(event) => setEditStatusName(event.target.value)}
                  disabled={isUpdatingStatus}
                />

                <label htmlFor="edit-status-description">
                  Edit status description
                </label>
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

                <label htmlFor="edit-status-display-order">
                  Edit display order
                </label>
                <input
                  id="edit-status-display-order"
                  name="editStatusDisplayOrder"
                  type="number"
                  min="1"
                  value={editStatusDisplayOrder}
                  onChange={(event) =>
                    setEditStatusDisplayOrder(event.target.value)
                  }
                  disabled={isUpdatingStatus}
                />

                <button type="submit" disabled={isUpdatingStatus}>
                  {isUpdatingStatus ? 'Saving status...' : 'Save status'}
                </button>

                <button
                  type="button"
                  onClick={cancelEditingStatus}
                  disabled={isUpdatingStatus}
                >
                  Cancel
                </button>
              </form>
            ) : null}
          </section>

          <section aria-label="view teams">
            <h3>Teams</h3>

            {!canViewTeams ? (
              <p>Only managers and administrators can view teams.</p>
            ) : null}

            {canViewTeams && isTeamsLoading ? <p>Loading teams...</p> : null}
            {canViewTeams && isUsersLoading ? <p>Loading users...</p> : null}

            {canViewTeams && !isTeamsLoading && teams.length === 0 ? (
              <p>No teams found.</p>
            ) : null}

            {canViewTeams && !isTeamsLoading && teams.length > 0 ? (
              <ul>
                {teams.map((team) => (
                  <li key={team.id}>
                    <span>{team.name}</span>{' '}
                    <button
                      type="button"
                      onClick={() => handleViewTeam(team.id)}
                      disabled={isTeamDetailLoading}
                    >
                      View details
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {canViewTeams && isTeamDetailLoading ? (
              <p>Loading team details...</p>
            ) : null}

            {selectedTeam ? (
              <section aria-label="team detail">
                <h4>{selectedTeam.name}</h4>

                {selectedTeam.members.length === 0 ? (
                  <p>No team members assigned.</p>
                ) : (
                  <ul>
                    {selectedTeam.members.map((member) => (
                      <li key={member.id}>
                        {member.firstName} {member.lastName} ({member.email}) -{' '}
                        {member.role}{' '}
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member)}
                          disabled={isRemovingMember || isAddingMember}
                        >
                          {isRemovingMember
                            ? 'Removing member...'
                            : `Remove ${member.firstName} ${member.lastName}`}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={handleAddMember} aria-label="add team member">
                  <label htmlFor="team-member-user">Team member</label>
                  <select
                    id="team-member-user"
                    name="teamMemberUser"
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                    disabled={isAddingMember || isUsersLoading}
                  >
                    <option value="">Select a user</option>
                    {organizationUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    disabled={isAddingMember || isUsersLoading}
                  >
                    {isAddingMember ? 'Adding member...' : 'Add member'}
                  </button>
                </form>
              </section>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
}
