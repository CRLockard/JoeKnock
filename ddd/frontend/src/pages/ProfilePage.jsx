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
    <section className="page-shell page-shell--narrow">
      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">Account</p>
          <h2>Profile</h2>
          <p className="page-header__description">
            Review your authenticated account information.
          </p>
        </div>
      </header>

      {isLoading ? <p className="feedback">Loading profile...</p> : null}
      {error ? (
        <p role="alert" className="feedback feedback--error">
          {error}
        </p>
      ) : null}

      {!isLoading && !error && profile ? (
        <div className="panel panel--profile">
          <dl className="detail-list">
            <div className="detail-list__row">
              <dt>First Name</dt>
              <dd>{profile.firstName}</dd>
            </div>
            <div className="detail-list__row">
              <dt>Last Name</dt>
              <dd>{profile.lastName}</dd>
            </div>
            <div className="detail-list__row">
              <dt>Email</dt>
              <dd>{profile.email}</dd>
            </div>
            <div className="detail-list__row">
              <dt>Role</dt>
              <dd>
                <span className="status-badge status-badge--info">
                  {profile.role}
                </span>
              </dd>
            </div>
            <div className="detail-list__row">
              <dt>Organization</dt>
              <dd>{profile.organizationId}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
