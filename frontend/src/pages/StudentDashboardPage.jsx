import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { getCourses } from '../api/courseApi';
import { getCourseTasks } from '../api/taskApi';
import { useAuth } from '../hooks/useAuth';
import { formatDateTime, isUpcoming, parseApiDate } from '../utils/date';
import { summarizeTasks } from '../utils/progress';

function DashboardStatCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <div className={`dashboard-stat-card dashboard-stat-card--${tone}`}>
      <span className="dashboard-stat-card__icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <div>
        <p className="dashboard-stat-card__label">{label}</p>
        <strong className="dashboard-stat-card__value">{value}</strong>
        <p className="dashboard-stat-card__detail">{detail}</p>
      </div>
    </div>
  );
}

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const requestRef = useRef(null);
  const [dashboard, setDashboard] = useState({ courses: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setError('');

    try {
      const courses = await getCourses({ signal: controller.signal });
      const taskGroups = await Promise.all(
        courses.map(async (course) => {
          const tasks = await getCourseTasks(course.id, { signal: controller.signal });
          return tasks.map((task) => ({ ...task, courseTitle: course.title }));
        }),
      );

      if (!controller.signal.aborted) {
        setDashboard({ courses, tasks: taskGroups.flat() });
      }
    } catch (requestError) {
      if (requestError?.name !== 'AbortError' && !controller.signal.aborted) {
        setError(requestError?.message || 'Your dashboard could not be loaded.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    return () => requestRef.current?.abort();
  }, [loadDashboard]);

  const now = new Date();
  const taskSummary = summarizeTasks(dashboard.tasks, now);
  const upcomingDeadlines = dashboard.tasks
    .filter((task) => isUpcoming(task.deadline, task.status, now))
    .sort((first, second) => (
      parseApiDate(first.deadline).getTime() - parseApiDate(second.deadline).getTime()
    ));
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'Student';

  const statCards = [
    {
      label: 'Courses',
      value: dashboard.courses.length,
      detail: dashboard.courses.length === 1 ? 'active course' : 'active courses',
      icon: BookOpen,
      tone: 'blue',
    },
    {
      label: 'Pending Tasks',
      value: taskSummary.pendingTasks,
      detail: taskSummary.overdueTasks
        ? `${taskSummary.overdueTasks} overdue`
        : 'Nothing overdue',
      icon: ClipboardList,
      tone: taskSummary.overdueTasks ? 'warning' : 'navy',
    },
    {
      label: 'Completed Tasks',
      value: taskSummary.completedTasks,
      detail: taskSummary.totalTasks
        ? `${taskSummary.progressPercentage}% overall progress`
        : 'Ready when you are',
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Upcoming',
      value: taskSummary.upcomingTasks,
      detail: 'due in the next 7 days',
      icon: CalendarClock,
      tone: 'amber',
    },
  ];

  return (
    <div className="student-dashboard" aria-busy={loading}>
      <header className="page-header student-dashboard__header">
        <div>
          <p className="page-header__eyebrow">Student overview</p>
          <h1>Welcome back, {firstName}</h1>
          <p>See what is coming up and choose the best next step for your studies.</p>
        </div>
        {!loading && (
          <button type="button" className="button button--secondary" onClick={loadDashboard}>
            <RefreshCw size={17} aria-hidden="true" /> Refresh
          </button>
        )}
      </header>

      {error && (
        <section className="alert alert--error student-dashboard__error" role="alert">
          <TriangleAlert size={20} aria-hidden="true" />
          <div>
            <strong>Dashboard unavailable</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="button button--secondary button--small" onClick={loadDashboard}>
            Try again
          </button>
        </section>
      )}

      {loading ? (
        <div className="page-loading-state" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          <p>Loading your study overview…</p>
        </div>
      ) : !error && (
        <>
          <section className="student-dashboard__stats" aria-label="Study statistics">
            {statCards.map((card) => <DashboardStatCard key={card.label} {...card} />)}
          </section>

          <div className="student-dashboard__content-grid">
            <section className="dashboard-panel dashboard-deadlines" aria-labelledby="upcoming-deadlines-title">
              <div className="dashboard-panel__header">
                <div>
                  <p className="dashboard-panel__eyebrow">Plan ahead</p>
                  <h2 id="upcoming-deadlines-title">Upcoming deadlines</h2>
                </div>
                <Link className="button button--quiet" to="/courses">View courses</Link>
              </div>

              {upcomingDeadlines.length ? (
                <div className="dashboard-deadlines__list">
                  {upcomingDeadlines.slice(0, 6).map((task) => {
                    const deadline = parseApiDate(task.deadline);
                    return (
                      <article key={task.id} className="dashboard-deadline">
                        <span className={`dashboard-deadline__priority dashboard-deadline__priority--${task.priority}`} aria-hidden="true" />
                        <div className="dashboard-deadline__details">
                          <h3>{task.title}</h3>
                          <p>{task.courseTitle}</p>
                          <span className="sr-only">{task.priority} priority.</span>
                        </div>
                        <span className="dashboard-deadline__date">
                          <Clock3 size={16} aria-hidden="true" />
                          <time dateTime={deadline.toISOString()}>{formatDateTime(deadline)}</time>
                        </span>
                      </article>
                    );
                  })}
                  {upcomingDeadlines.length > 6 && (
                    <p className="dashboard-deadlines__remaining">
                      {upcomingDeadlines.length - 6} more upcoming task{upcomingDeadlines.length - 6 === 1 ? '' : 's'} in your courses.
                    </p>
                  )}
                </div>
              ) : (
                <div className="empty-state dashboard-panel__empty">
                  <CalendarClock size={34} aria-hidden="true" />
                  <h3>No deadlines in the next seven days</h3>
                  <p>
                    {dashboard.courses.length
                      ? 'You are clear for now. Open Courses to review the rest of your tasks.'
                      : 'Add your first course and task to start tracking deadlines.'}
                  </p>
                  <Link className="button button--secondary button--small" to="/courses">
                    {dashboard.courses.length ? 'Review courses' : 'Add a course'}
                  </Link>
                </div>
              )}
            </section>

            <aside className="dashboard-ai-card" aria-labelledby="dashboard-ai-title">
              <span className="dashboard-ai-card__icon" aria-hidden="true"><Sparkles size={26} /></span>
              <p className="dashboard-ai-card__eyebrow">AI Study Planner</p>
              <h2 id="dashboard-ai-title">Turn a topic into a focused plan</h2>
              <p>Choose your available time and difficulty, then let StudyPilot organize a practical study session.</p>
              <Link className="button button--light" to="/ai-planner">
                Generate Study Plan <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
