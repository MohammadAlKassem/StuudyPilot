import { CheckCircle2, Clock3, Pencil, Trash2 } from 'lucide-react';
import { formatDateTime, isOverdue, parseApiDate } from '../../utils/date';

export default function TaskRow({ task, onToggle, onEdit, onDelete, busy = false }) {
  const completed = task.status === 'completed';
  const overdue = isOverdue(task.deadline, task.status);
  const parsedDeadline = parseApiDate(task.deadline);

  return (
    <article className={`task-row${completed ? ' task-row--completed' : ''}`}>
      <div className="task-row__completion">
        <input
          id={`task-${task.id}-complete`}
          className="task-row__checkbox"
          type="checkbox"
          checked={completed}
          onChange={() => onToggle(task)}
          disabled={busy}
        />
        <label className="visually-hidden" htmlFor={`task-${task.id}-complete`}>
          {completed ? `Reopen ${task.title}` : `Mark ${task.title} complete`}
        </label>
        {completed && <CheckCircle2 className="task-row__check-icon" size={18} aria-hidden="true" />}
      </div>

      <div className="task-row__details">
        <h4 className="task-row__title">{task.title}</h4>
        {task.description && <p className="task-row__description">{task.description}</p>}
        <div className="task-row__metadata">
          <span className={`status-badge status-badge--priority-${task.priority}`}>
            {task.priority} priority
          </span>
          <span className={`status-badge status-badge--${task.status}`}>{task.status}</span>
          <span className={`task-row__deadline${overdue ? ' task-row__deadline--overdue' : ''}`}>
            <Clock3 size={15} aria-hidden="true" />
            {parsedDeadline ? (
              <time dateTime={parsedDeadline.toISOString()}>{formatDateTime(parsedDeadline)}</time>
            ) : 'No deadline'}
            {overdue && <span className="visually-hidden"> (overdue)</span>}
          </span>
        </div>
      </div>

      <div className="task-row__actions">
        <button
          type="button"
          className="button button--quiet"
          onClick={() => onEdit(task)}
          disabled={busy}
          aria-label={`Edit task ${task.title}`}
        >
          <Pencil size={16} aria-hidden="true" />
          <span>Edit</span>
        </button>
        <button
          type="button"
          className="button button--quiet-danger"
          onClick={() => onDelete(task)}
          disabled={busy}
          aria-label={`Delete task ${task.title}`}
        >
          <Trash2 size={16} aria-hidden="true" />
          <span>Delete</span>
        </button>
      </div>
    </article>
  );
}
