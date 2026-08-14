import { useEffect, useState } from 'react';
import { getOrganization, updateOrganization } from '../api/organizationApi.js';
import { useAuth } from '../auth/useAuth.js';

export function SettingsPage() {
  const auth = useAuth();
  const [organization, setOrganization] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = auth.user?.role === 'admin';

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

  return (
    <section>
      <h2>Organization Settings</h2>
      {isLoading ? <p>Loading organization...</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {successMessage ? <p role="status">{successMessage}</p> : null}

      {!isLoading && organization ? (
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
      ) : null}
    </section>
  );
}
