import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleCheckBig,
  CircleX,
  GraduationCap,
  LoaderCircle,
  ListTodo,
  Power,
  PowerOff,
  RefreshCw,
  Shield,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

import {
  getAdminStats,
  getAdminUsers,
  getAiLogs,
  updateUserStatus,
} from '../api/adminApi.js';
import { useAuth } from '../hooks/useAuth.js';
import { formatDateTime } from '../utils/date.js';

const STAT_CARDS = [
  { key: 'totalStudents', label: 'Students', Icon: GraduationCap, tone: 'blue' },
  { key: 'activeStudents', label: 'Active Students', Icon: UserCheck, tone: 'green' },
  { key: 'totalCourses', label: 'Courses', Icon: Shield, tone: 'navy' },
  { key: 'totalTasks', label: 'Tasks', Icon: ListTodo, tone: 'blue' },
  { key: 'completedTasks', label: 'Completed Tasks', Icon: CircleCheckBig, tone: 'green' },
  { key: 'totalAiRequests', label: 'AI Requests', Icon: Bot, tone: 'navy' },
  { key: 'successfulAiRequests', label: 'Successful AI Requests', Icon: CheckCircle2, tone: 'green' },
  { key: 'failedAiRequests', label: 'Failed AI Requests', Icon: CircleX, tone: 'red' },
];

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function Modal({ title, description, busy = false, onClose, children }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    const selector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    document.body.style.overflow = 'hidden';
    (dialog?.querySelector('[data-modal-initial-focus]')
      ?? dialog?.querySelector(selector))?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll(selector)];
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const fallback = document.querySelector('#main-content button:not([disabled]), #main-content a[href]');
      (previouslyFocused?.isConnected ? previouslyFocused : fallback)?.focus?.();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="modal admin-dashboard__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user: currentUser } = useAuth();
  const statsRequestSequence = useRef(0);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState('');
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadStats = useCallback(async ({ signal } = {}) => {
    const requestId = ++statsRequestSequence.current;
    setStatsLoading(true);
    setStatsError('');
    try {
      const result = await getAdminStats({ signal });
      if (requestId === statsRequestSequence.current && !signal?.aborted) setStats(result);
    } catch (error) {
      if (error?.name !== 'AbortError' && requestId === statsRequestSequence.current) {
        setStatsError(getErrorMessage(error, 'Could not load platform statistics.'));
      }
    } finally {
      if (!signal?.aborted && requestId === statsRequestSequence.current) {
        setStatsLoading(false);
      }
    }
  }, []);

  const loadUsers = useCallback(async ({ signal } = {}) => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const result = await getAdminUsers({ signal });
      setUsersList(Array.isArray(result) ? result : []);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setUsersError(getErrorMessage(error, 'Could not load users.'));
      }
    } finally {
      if (!signal?.aborted) setUsersLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async ({ signal } = {}) => {
    setLogsLoading(true);
    setLogsError('');
    try {
      const result = await getAiLogs({ signal });
      setLogs(Array.isArray(result) ? result.slice(0, 6) : []);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setLogsError(getErrorMessage(error, 'Could not load recent AI activity.'));
      }
    } finally {
      if (!signal?.aborted) setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    loadStats(options);
    loadUsers(options);
    loadLogs(options);
    return () => {
      controller.abort();
      statsRequestSequence.current += 1;
    };
  }, [loadLogs, loadStats, loadUsers]);

  function refreshAll() {
    setActionError('');
    setSuccessMessage('');
    loadStats();
    loadUsers();
    loadLogs();
  }

  function requestStatusChange(user) {
    const isCurrentAccount = Number(user.id) === Number(currentUser?.id);
    if (isCurrentAccount && user.isActive) return;
    setActionError('');
    setSuccessMessage('');
    setStatusTarget({ user, isActive: !user.isActive });
  }

  async function confirmStatusChange() {
    if (!statusTarget || statusSaving) return;
    const { user, isActive } = statusTarget;
    setStatusSaving(true);
    setActionError('');
    setSuccessMessage('');

    try {
      const updated = await updateUserStatus(user.id, isActive);
      setUsersList((current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )));
      setStatusTarget(null);
      setSuccessMessage(`User ${updated.isActive ? 'activated' : 'deactivated'} successfully.`);
      await loadStats();
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not update this user.'));
      setStatusTarget(null);
    } finally {
      setStatusSaving(false);
    }
  }

  const refreshing = statsLoading || usersLoading || logsLoading;

  return (
    <div className="page-shell admin-dashboard">
      <header className="page-header admin-dashboard__header">
        <div>
          <p className="page-header__eyebrow">StudyPilot administration</p>
          <h1>Admin Dashboard</h1>
          <p>Overview of platform activity and user management</p>
        </div>
        <button
          type="button"
          className="button button--secondary"
          onClick={refreshAll}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? 'spin' : ''} aria-hidden="true" />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </header>

      <div className="feedback-region" aria-live="polite" aria-atomic="true">
        {successMessage ? (
          <div className="alert alert--success" role="status">
            <CheckCircle2 aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
        ) : null}
        {actionError ? (
          <div className="alert alert--error" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        ) : null}
      </div>

      <section className="admin-dashboard__stats" aria-labelledby="platform-overview-title">
        <div className="section-heading section-heading--with-action">
          <div className="section-heading__title">
            <div className="section-heading__icon" aria-hidden="true"><Activity /></div>
            <div>
              <h2 id="platform-overview-title">Platform Overview</h2>
              <p>Current totals from StudyPilot.</p>
            </div>
          </div>
        </div>

        {statsLoading ? (
          <div className="loading-state" role="status">
            <LoaderCircle className="spin" aria-hidden="true" />
            <span>Loading platform statistics...</span>
          </div>
        ) : statsError ? (
          <div className="empty-state empty-state--error" role="alert">
            <AlertCircle aria-hidden="true" />
            <h3>Statistics could not be loaded</h3>
            <p>{statsError}</p>
            <button type="button" className="button button--secondary" onClick={() => loadStats()}>
              <RefreshCw aria-hidden="true" /> Try Again
            </button>
          </div>
        ) : (
          <div className="admin-dashboard__stat-grid">
            {STAT_CARDS.map(({ key, label, Icon, tone }) => (
              <div className="stat-card" key={key}>
                <div className={`stat-card__icon stat-card__icon--${tone}`} aria-hidden="true">
                  <Icon />
                </div>
                <div>
                  <p>{label}</p>
                  <strong>{Number(stats?.[key] ?? 0).toLocaleString()}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface-card admin-dashboard__users" aria-labelledby="users-title">
        <div className="section-heading section-heading--with-action">
          <div className="section-heading__title">
            <div className="section-heading__icon" aria-hidden="true"><Users /></div>
            <div>
              <h2 id="users-title">Users</h2>
              <p>Manage account access without changing user roles or data.</p>
            </div>
          </div>
          {!usersLoading ? (
            <button type="button" className="button button--ghost" onClick={() => loadUsers()}>
              <RefreshCw aria-hidden="true" /> Refresh
            </button>
          ) : null}
        </div>

        {usersLoading ? (
          <div className="loading-state" role="status">
            <LoaderCircle className="spin" aria-hidden="true" />
            <span>Loading users...</span>
          </div>
        ) : usersError ? (
          <div className="empty-state empty-state--error" role="alert">
            <AlertCircle aria-hidden="true" />
            <h3>Users could not be loaded</h3>
            <p>{usersError}</p>
            <button type="button" className="button button--secondary" onClick={() => loadUsers()}>
              <RefreshCw aria-hidden="true" /> Try Again
            </button>
          </div>
        ) : usersList.length === 0 ? (
          <div className="empty-state">
            <Users aria-hidden="true" />
            <h3>No users found</h3>
            <p>User accounts will appear here after registration.</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex="0" role="region" aria-label="User management table">
            <table className="data-table admin-dashboard__user-table">
              <caption className="sr-only">User accounts and access status</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((account) => {
                  const isCurrentAccount = Number(account.id) === Number(currentUser?.id);
                  const actionDisabled = statusSaving || (isCurrentAccount && account.isActive);
                  return (
                    <tr key={account.id}>
                      <td data-label="Name">
                        <div className="admin-dashboard__user-name">
                          <span className="avatar avatar--small" aria-hidden="true">
                            {(account.name || '?').trim().charAt(0).toUpperCase()}
                          </span>
                          <span>
                            {account.name}
                            {isCurrentAccount ? <small>Current account</small> : null}
                          </span>
                        </div>
                      </td>
                      <td data-label="Email">{account.email}</td>
                      <td data-label="Role">
                        <span className={`role-badge role-badge--${account.role}`}>
                          {account.role}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`status-badge ${account.isActive ? 'status-badge--success' : 'status-badge--danger'}`}>
                          <span className="status-badge__dot" aria-hidden="true" />
                          {account.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td data-label="Created">{formatDateTime(account.createdAt)}</td>
                      <td data-label="Action">
                        <button
                          type="button"
                          className={`button button--compact ${account.isActive ? 'button--danger-ghost' : 'button--success-ghost'}`}
                          onClick={() => requestStatusChange(account)}
                          disabled={actionDisabled}
                          title={isCurrentAccount && account.isActive
                            ? 'You cannot deactivate your own administrator account.'
                            : undefined}
                          aria-label={isCurrentAccount && account.isActive
                            ? `Current administrator account: ${account.name}`
                            : `${account.isActive ? 'Deactivate' : 'Activate'} ${account.name}`}
                        >
                          {statusSaving && statusTarget?.user.id === account.id ? (
                            <LoaderCircle className="spin" aria-hidden="true" />
                          ) : account.isActive ? (
                            <PowerOff aria-hidden="true" />
                          ) : (
                            <Power aria-hidden="true" />
                          )}
                          {isCurrentAccount && account.isActive
                            ? 'Current Account'
                            : account.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface-card admin-dashboard__ai-activity" aria-labelledby="ai-activity-title">
        <div className="section-heading section-heading--with-action">
          <div className="section-heading__title">
            <div className="section-heading__icon" aria-hidden="true"><Bot /></div>
            <div>
              <h2 id="ai-activity-title">Recent AI Activity</h2>
              <p>A compact view of the newest study-planning requests.</p>
            </div>
          </div>
          {!logsLoading ? (
            <button type="button" className="button button--ghost" onClick={() => loadLogs()}>
              <RefreshCw aria-hidden="true" /> Refresh
            </button>
          ) : null}
        </div>

        {logsLoading ? (
          <div className="loading-state" role="status">
            <LoaderCircle className="spin" aria-hidden="true" />
            <span>Loading recent AI activity...</span>
          </div>
        ) : logsError ? (
          <div className="empty-state empty-state--error" role="alert">
            <AlertCircle aria-hidden="true" />
            <h3>AI activity could not be loaded</h3>
            <p>{logsError}</p>
            <button type="button" className="button button--secondary" onClick={() => loadLogs()}>
              <RefreshCw aria-hidden="true" /> Try Again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <Bot aria-hidden="true" />
            <h3>No AI requests yet</h3>
            <p>Recent study-planning activity will appear here.</p>
          </div>
        ) : (
          <ul className="ai-activity-list">
            {logs.map((log) => (
              <li className="ai-activity-item" key={log.id}>
                <div className={`ai-activity-item__icon ai-activity-item__icon--${log.status}`} aria-hidden="true">
                  {log.status === 'success' ? <CheckCircle2 /> : <CircleX />}
                </div>
                <div className="ai-activity-item__body">
                  <div className="ai-activity-item__heading">
                    <div>
                      <strong>{log.userName}</strong>
                      <span>{log.userEmail}</span>
                    </div>
                    <span className={`status-badge ${log.status === 'success' ? 'status-badge--success' : 'status-badge--danger'}`}>
                      {log.status === 'success' ? 'Successful' : 'Failed'}
                    </span>
                  </div>
                  {log.status === 'failed' ? (
                    <p className="ai-activity-item__error">
                      {log.errorMessage || 'The request could not be completed.'}
                    </p>
                  ) : (
                    <p className="ai-activity-item__message">Study plan generated successfully.</p>
                  )}
                  <time dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {statusTarget ? (
        <Modal
          title={`${statusTarget.isActive ? 'Activate' : 'Deactivate'} User?`}
          description="This changes whether the account can access StudyPilot."
          busy={statusSaving}
          onClose={() => setStatusTarget(null)}
        >
          <div className="confirm-dialog__body">
            <div
              className={`confirm-dialog__icon ${statusTarget.isActive ? 'confirm-dialog__icon--success' : 'confirm-dialog__icon--danger'}`}
              aria-hidden="true"
            >
              {statusTarget.isActive ? <Power /> : <PowerOff />}
            </div>
            <p>
              {statusTarget.isActive ? 'Restore' : 'Remove'} access for{' '}
              <strong>{statusTarget.user.name}</strong>?
            </p>
          </div>
          <div className="modal__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setStatusTarget(null)}
              disabled={statusSaving}
              data-modal-initial-focus="true"
            >
              Cancel
            </button>
            <button
              type="button"
              className={`button ${statusTarget.isActive ? 'button--success' : 'button--danger'}`}
              onClick={confirmStatusChange}
              disabled={statusSaving}
            >
              {statusSaving ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : statusTarget.isActive ? (
                <Power aria-hidden="true" />
              ) : (
                <PowerOff aria-hidden="true" />
              )}
              {statusSaving
                ? 'Saving...'
                : statusTarget.isActive ? 'Activate User' : 'Deactivate User'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
