import { Link } from 'react-router-dom';

const SETTINGS_ITEMS = [
  {
    id: 'company',
    label: 'Company Info',
    to: '/settings?section=company',
  },
  {
    id: 'teams',
    label: 'Teams',
    to: '/settings?section=teams',
  },
  {
    id: 'users',
    label: 'Users',
    to: '/settings/users',
  },
  {
    id: 'statuses',
    label: 'Statuses',
    to: '/settings?section=statuses',
  },
  {
    id: 'visibility',
    label: 'Visibility Settings',
    to: '/settings?section=visibility',
  },
  {
    id: 'export',
    label: 'Export',
    to: '/reports/activity',
  },
];

export function SettingsWorkspace({
  title,
  description,
  activeSection,
  actions = null,
  children,
}) {
  return (
    <section className="settings-workspace-page">
      <aside className="settings-sidebar" aria-label="Settings navigation">
        <nav className="settings-sidebar__nav">
          {SETTINGS_ITEMS.map((item) => {
            // Settings are modeled as one workspace with sections so shared
            // context (org/team/status) stays visible while moving between
            // management tasks.
            const isActive = activeSection === item.id;

            return (
              <Link
                key={item.id}
                to={item.to}
                className={`settings-sidebar__link${isActive ? ' settings-sidebar__link--active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="settings-workspace">
        <header className="page-header page-header--workspace">
          <div>
            <p className="page-header__eyebrow">Settings</p>
            <h2>{title}</h2>
            {description ? (
              <p className="page-header__description">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="page-header__actions">{actions}</div>
          ) : null}
        </header>

        <div className="settings-workspace__content">{children}</div>
      </div>
    </section>
  );
}
