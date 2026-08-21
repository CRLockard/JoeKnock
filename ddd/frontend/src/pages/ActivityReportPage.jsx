import { useEffect, useState } from 'react';
import { exportPropertiesCsv } from '../api/exportsApi.js';
import { getActivityReport } from '../api/reportsApi.js';
import { getStatuses } from '../api/statusesApi.js';
import { getTeams } from '../api/teamsApi.js';
import { getUsers } from '../api/usersApi.js';
import { useAuth } from '../auth/useAuth.js';

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function emptyReport() {
  return {
    dateRange: {
      dateFrom: '',
      dateTo: '',
      timezone: '',
    },
    appliedFilters: {
      userId: null,
      teamId: null,
      statusId: null,
    },
    summary: {
      totalKnocks: 0,
      totalStatusActivityGroups: 0,
    },
    byStatus: [],
    byRepresentative: [],
  };
}

export function ActivityReportPage() {
  const auth = useAuth();
  const [dateFrom, setDateFrom] = useState(todayDateString());
  const [dateTo, setDateTo] = useState(todayDateString());
  const [userId, setUserId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [report, setReport] = useState(() => emptyReport());
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [reportError, setReportError] = useState('');
  const [exportError, setExportError] = useState('');

  const canViewReports =
    auth.user?.role === 'manager' || auth.user?.role === 'admin';

  useEffect(() => {
    if (!canViewReports) {
      setIsLoadingOptions(false);
      return;
    }

    let isMounted = true;

    async function loadOptions() {
      setOptionsError('');
      setIsLoadingOptions(true);

      try {
        // Filters are loaded independently from report data so the page can
        // render selection controls before the first query is run.
        const [usersResponse, teamsResponse, statusesResponse] =
          await Promise.all([getUsers(), getTeams(), getStatuses()]);

        if (!isMounted) {
          return;
        }

        setUsers(Array.isArray(usersResponse) ? usersResponse : []);
        setTeams(Array.isArray(teamsResponse) ? teamsResponse : []);
        setStatuses(Array.isArray(statusesResponse) ? statusesResponse : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setOptionsError(error.message || 'Unable to load report filters.');
      } finally {
        if (isMounted) {
          setIsLoadingOptions(false);
        }
      }
    }

    void loadOptions();

    return () => {
      isMounted = false;
    };
  }, [canViewReports]);

  async function handleRunReport(event) {
    event.preventDefault();

    setReportError('');
    setIsLoadingReport(true);

    try {
      // dateFrom/dateTo are calendar dates. Backend resolves these against the
      // organization timezone before converting to UTC query boundaries.
      const response = await getActivityReport({
        dateFrom,
        dateTo,
        userId: userId || undefined,
        teamId: teamId || undefined,
        statusId: statusId || undefined,
      });

      setReport(response ?? emptyReport());
    } catch (error) {
      setReportError(error.message || 'Unable to load activity report.');
    } finally {
      setIsLoadingReport(false);
    }
  }

  async function handleExportCsv() {
    setExportError('');
    setIsExporting(true);

    try {
      // Export reuses the same filter model as report queries so downloaded CSV
      // matches what users are viewing in the UI.
      const response = await exportPropertiesCsv({
        dateFrom,
        dateTo,
        userId: userId || undefined,
        teamId: teamId || undefined,
        statusId: statusId || undefined,
      });

      const downloadUrl = window.URL.createObjectURL(response.blob);
      const link = document.createElement('a');

      link.href = downloadUrl;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setExportError(error.message || 'Unable to export activity CSV.');
    } finally {
      setIsExporting(false);
    }
  }

  if (!canViewReports) {
    return (
      <section>
        <h2>Activity Report</h2>
        <p role="alert">You do not have permission to view reports.</p>
      </section>
    );
  }

  const hasData =
    report.summary.totalKnocks > 0 ||
    report.byStatus.length > 0 ||
    report.byRepresentative.length > 0;

  return (
    <section aria-label="Activity reporting" className="page-shell">
      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">Reports</p>
          <h2>Activity Report</h2>
          <p className="page-header__description">
            Review current property activity and export the filtered results.
          </p>
        </div>
      </header>

      <div className="panel panel--filters">
        <form
          onSubmit={handleRunReport}
          aria-label="activity report filters"
          className="filters-grid"
        >
          <label className="form-field">
            <span>Date from</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span>Date to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span>Representative</span>
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              disabled={isLoadingOptions}
            >
              <option value="">All representatives</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {`${user.firstName} ${user.lastName} (${user.email})`}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Team</span>
            <select
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              disabled={isLoadingOptions}
            >
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Status</span>
            <select
              value={statusId}
              onChange={(event) => setStatusId(event.target.value)}
              disabled={isLoadingOptions}
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </label>

          <div className="filters-grid__actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={isLoadingReport}
            >
              {isLoadingReport ? 'Loading report...' : 'Run report'}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={handleExportCsv}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </form>
      </div>

      {optionsError ? (
        <p role="alert" className="feedback feedback--error">
          {optionsError}
        </p>
      ) : null}
      {reportError ? (
        <p role="alert" className="feedback feedback--error">
          {reportError}
        </p>
      ) : null}
      {exportError ? (
        <p role="alert" className="feedback feedback--error">
          {exportError}
        </p>
      ) : null}

      <div className="summary-grid" aria-live="polite">
        <div className="summary-card">
          <span>Total Knocks</span>
          <strong>{report.summary.totalKnocks}</strong>
        </div>
        <div className="summary-card">
          <span>Status Activity Groups</span>
          <strong>{report.summary.totalStatusActivityGroups}</strong>
        </div>
        <div className="summary-card">
          <span>Timezone</span>
          <strong>{report.dateRange.timezone || 'Unavailable'}</strong>
        </div>
      </div>

      {!isLoadingReport && !reportError && !hasData ? (
        <p className="feedback">No activity found for the selected filters.</p>
      ) : null}

      <div className="report-grid">
        <section aria-label="Status grouping" className="panel panel--table">
          <div className="panel__header">
            <h3>By Status</h3>
          </div>
          {report.byStatus.length === 0 ? (
            <p className="feedback">No status activity found.</p>
          ) : (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Knocks</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byStatus.map((row) => (
                    <tr key={row.statusId}>
                      <td>{row.statusName}</td>
                      <td>{row.knocks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          aria-label="Representative grouping"
          className="panel panel--table"
        >
          <div className="panel__header">
            <h3>By Representative</h3>
          </div>
          {report.byRepresentative.length === 0 ? (
            <p className="feedback">No representative activity found.</p>
          ) : (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Representative</th>
                    <th scope="col">Knocks</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byRepresentative.map((row) => (
                    <tr key={row.userId}>
                      <td>{`${row.firstName} ${row.lastName} (${row.email})`}</td>
                      <td>{row.knocks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
