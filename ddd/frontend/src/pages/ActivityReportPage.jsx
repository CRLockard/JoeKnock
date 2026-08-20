import { useEffect, useState } from 'react';
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
  const [optionsError, setOptionsError] = useState('');
  const [reportError, setReportError] = useState('');

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
    <section aria-label="Activity reporting">
      <h2>Activity Report</h2>

      <form onSubmit={handleRunReport} aria-label="activity report filters">
        <label>
          Date from
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            required
          />
        </label>

        <label>
          Date to
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            required
          />
        </label>

        <label>
          Representative
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

        <label>
          Team
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

        <label>
          Status
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

        <button type="submit" disabled={isLoadingReport}>
          {isLoadingReport ? 'Loading report...' : 'Run report'}
        </button>
      </form>

      {optionsError ? <p role="alert">{optionsError}</p> : null}
      {reportError ? <p role="alert">{reportError}</p> : null}

      <div aria-live="polite">
        <p>Total knocks: {report.summary.totalKnocks}</p>
        <p>
          Status activity groups in range:{' '}
          {report.summary.totalStatusActivityGroups}
        </p>
        {report.dateRange.timezone ? (
          <p>{`Organization timezone: ${report.dateRange.timezone}`}</p>
        ) : null}
      </div>

      {!isLoadingReport && !reportError && !hasData ? (
        <p>No activity found for the selected filters.</p>
      ) : null}

      <section aria-label="Status grouping">
        <h3>By Status</h3>
        {report.byStatus.length === 0 ? (
          <p>No status activity found.</p>
        ) : (
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
        )}
      </section>

      <section aria-label="Representative grouping">
        <h3>By Representative</h3>
        {report.byRepresentative.length === 0 ? (
          <p>No representative activity found.</p>
        ) : (
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
        )}
      </section>
    </section>
  );
}
