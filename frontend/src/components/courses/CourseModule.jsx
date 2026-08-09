import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { calculateProgress } from '../../utils/progress';
import CourseProgress from './CourseProgress';
import TaskRow from './TaskRow';

export default function CourseModule({
  course,
  index,
  expanded,
  taskBucket,
  courseBusy = false,
  busyTaskIds,
  onToggleExpanded,
  onRetryTasks,
  onEditCourse,
  onDeleteCourse,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
}) {
  const tasks = taskBucket?.items ?? [];
  const tasksLoaded = Boolean(taskBucket?.loaded);
  const totalCount = tasksLoaded ? tasks.length : Number(course.taskCount) || 0;
  const completedCount = tasksLoaded
    ? tasks.filter((task) => task.status === 'completed').length
    : Number(course.completedTaskCount) || 0;
  const progress = tasksLoaded
    ? calculateProgress(tasks)
    : Number(course.progressPercentage) || 0;
  const contentId = `course-${course.id}-tasks`;

  return (
    <article className={`course-module${progress === 100 && totalCount ? ' course-module--complete' : ''}`}>
      <div className="course-module__header">
        <div className="course-module__number" aria-hidden="true">{index + 1}</div>
        <div className="course-module__identity">
          <div className="course-module__title-row">
            <h2 className="course-module__title">{course.title}</h2>
            {progress === 100 && totalCount > 0 && (
              <span className="course-module__complete-label">
                <CheckCircle2 size={17} aria-hidden="true" /> Complete
              </span>
            )}
          </div>
          <CourseProgress
            value={progress}
            completedCount={completedCount}
            totalCount={totalCount}
            courseTitle={course.title}
          />
        </div>
        <div className="course-module__actions">
          <button
            type="button"
            className="button button--quiet"
            onClick={() => onEditCourse(course)}
            disabled={courseBusy}
            aria-label={`Edit course ${course.title}`}
          >
            <Pencil size={16} aria-hidden="true" />
            <span>Edit course</span>
          </button>
          <button
            type="button"
            className="button button--quiet-danger"
            onClick={() => onDeleteCourse(course)}
            disabled={courseBusy}
            aria-label={`Delete course ${course.title}`}
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>Delete course</span>
          </button>
          <button
            type="button"
            className="course-module__expand-button"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => onToggleExpanded(course.id)}
            disabled={courseBusy}
            aria-label={`${expanded ? 'Hide' : 'Show'} tasks for ${course.title}`}
          >
            <span>{expanded ? 'Hide tasks' : 'Show tasks'}</span>
            {expanded
              ? <ChevronUp size={20} aria-hidden="true" />
              : <ChevronDown size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {expanded && (
        <section id={contentId} className="course-module__tasks" aria-label={`Tasks for ${course.title}`}>
          <div className="course-module__tasks-header">
            <div>
              <h3>Course tasks</h3>
              <p>Track each step and keep your module progress current.</p>
            </div>
            <button
              type="button"
              className="button button--primary button--small"
              onClick={() => onAddTask(course)}
              disabled={!tasksLoaded || taskBucket?.status === 'loading'}
            >
              <Plus size={17} aria-hidden="true" /> Add task
            </button>
          </div>

          {taskBucket?.status === 'loading' && (
            <div className="module-state" role="status">
              <span className="loading-spinner" aria-hidden="true" />
              Loading tasks…
            </div>
          )}

          {taskBucket?.status === 'error' && (
            <div className="module-state module-state--error" role="alert">
              <p>{taskBucket.error || 'Tasks could not be loaded.'}</p>
              <button type="button" className="button button--secondary button--small" onClick={() => onRetryTasks(course.id)}>
                <RefreshCw size={16} aria-hidden="true" /> Retry
              </button>
            </div>
          )}

          {tasksLoaded && taskBucket?.status !== 'loading' && (
            tasks.length ? (
              <div className="course-module__task-list">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    busy={busyTaskIds.has(task.id)}
                    onToggle={onToggleTask}
                    onEdit={(selectedTask) => onEditTask(course, selectedTask)}
                    onDelete={(selectedTask) => onDeleteTask(course, selectedTask)}
                  />
                ))}
              </div>
            ) : (
              <div className="module-state module-state--empty">
                <p>No tasks yet. Add the first task for this course.</p>
              </div>
            )
          )}
        </section>
      )}
    </article>
  );
}
