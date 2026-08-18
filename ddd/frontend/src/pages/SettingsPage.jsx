import { useEffect, useState } from 'react';
import { getOrganization, updateOrganization } from '../api/organizationApi.js';
import { createTeam } from '../api/teamsApi.js';
import { useAuth } from '../auth/useAuth.js';

export function SettingsPage() {
  const auth = useAuth();
  const [organization, setOrganization] = useState(null);
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [teamError, setTeamError] = useState('');
  const [teamSuccessMessage, setTeamSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  const isAdmin = auth.user?.role === 'admin';
  const canCreateTeams = isAdmin || auth.user?.role === 'manager';

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
    } catch (createError) {
      setTeamError(createError.message || 'Unable to create team.');
    } finally {
      setIsCreatingTeam(false);
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
        </>
      ) : null}
    </section>
  );
}
