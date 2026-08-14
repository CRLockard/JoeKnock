import { useEffect, useState } from 'react';
import { getCurrentUser } from '../api/authApi.js';

export function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        // Profile data is loaded from the authenticated API context so the UI
        // cannot drift from server-enforced identity and organization scope.
        const response = await getCurrentUser();

        if (!isMounted) {
          return;
        }

        setProfile(response);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError.message || 'Unable to load profile.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section>
      <h2>Profile</h2>
      {isLoading ? <p>Loading profile...</p> : null}

      {error ? <p role="alert">{error}</p> : null}

      {!isLoading && !error && profile ? (
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{`${profile.firstName} ${profile.lastName}`}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{profile.role}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{profile.organizationId}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
