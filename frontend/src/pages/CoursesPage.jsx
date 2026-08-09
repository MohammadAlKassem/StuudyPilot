import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Plus, RefreshCw, TriangleAlert, X } from 'lucide-react';
import {
  createCourse,
  deleteCourse,
  getCourses,
  updateCourse,
} from '../api/courseApi';
import {
  createTask,
  deleteTask,
  getCourseTasks,
  updateTask,
} from '../api/taskApi';
import ConfirmDialog from '../components/courses/ConfirmDialog';
import CourseForm from '../components/courses/CourseForm';
import CourseModule from '../components/courses/CourseModule';
import Modal from '../components/courses/Modal';
import TaskForm from '../components/courses/TaskForm';
import { sortTasks } from '../utils/progress';

function updateBusySet(setter, id, busy) {
  setter((current) => {
    const next = new Set(current);
    if (busy) next.add(id);
    else next.delete(id);
    return next;
  });
}

export default function CoursesPage() {
  const courseRequestRef = useRef(null);
  const taskRequestControllers = useRef(new Map());
  const [courses, setCourses] = useState([]);
  const [tasksByCourse, setTasksByCourse] = useState({});
  const [expandedCourseIds, setExpandedCourseIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [actionError, setActionError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [formDialog, setFormDialog] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyCourseIds, setBusyCourseIds] = useState(() => new Set());
  const [busyTaskIds, setBusyTaskIds] = useState(() => new Set());

  const updateExactCourseSummary = useCallback((courseId, tasks) => {
    const taskCount = tasks.length;
    const completedTaskCount = tasks.filter((task) => task.status === 'completed').length;
    const progressPercentage = taskCount
      ? Math.round((completedTaskCount / taskCount) * 100)
      : 0;

    setCourses((current) => current.map((course) => (
      course.id === courseId
        ? { ...course, taskCount, completedTaskCount, progressPercentage }
        : course
    )));
  }, []);

  const adjustCourseSummary = useCallback((courseId, taskDelta, completedDelta) => {
    setCourses((current) => current.map((course) => {
      if (course.id !== courseId) return course;

      const taskCount = Math.max(0, (Number(course.taskCount) || 0) + taskDelta);
      const completedTaskCount = Math.min(
        taskCount,
        Math.max(0, (Number(course.completedTaskCount) || 0) + completedDelta),
      );

      return {
        ...course,
        taskCount,
        completedTaskCount,
        progressPercentage: taskCount
          ? Math.round((completedTaskCount / taskCount) * 100)
          : 0,
      };
    }));
  }, []);

  const loadCourses = useCallback(async () => {
    courseRequestRef.current?.abort();
    const controller = new AbortController();
    courseRequestRef.current = controller;

    setLoading(true);
    setPageError('');

    try {
      const courseList = await getCourses({ signal: controller.signal });
      if (!controller.signal.aborted) setCourses(courseList);
    } catch (error) {
      if (error?.name !== 'AbortError' && !controller.signal.aborted) {
        setPageError(error?.message || 'Courses could not be loaded.');
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (courseRequestRef.current === controller) courseRequestRef.current = null;
    }
  }, []);

  const loadTasks = useCallback(async (courseId) => {
    if (taskRequestControllers.current.has(courseId)) return;

    const controller = new AbortController();
    taskRequestControllers.current.set(courseId, controller);
    setTasksByCourse((current) => ({
      ...current,
      [courseId]: {
        items: current[courseId]?.items ?? [],
        loaded: false,
        status: 'loading',
        error: '',
      },
    }));

    try {
      const tasks = sortTasks(await getCourseTasks(courseId, { signal: controller.signal }));
      if (!controller.signal.aborted) {
        setTasksByCourse((current) => ({
          ...current,
          [courseId]: { items: tasks, loaded: true, status: 'success', error: '' },
        }));
        updateExactCourseSummary(courseId, tasks);
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && !controller.signal.aborted) {
        setTasksByCourse((current) => ({
          ...current,
          [courseId]: {
            items: current[courseId]?.items ?? [],
            loaded: false,
            status: 'error',
            error: error?.message || 'Tasks could not be loaded.',
          },
        }));
      }
    } finally {
      if (taskRequestControllers.current.get(courseId) === controller) {
        taskRequestControllers.current.delete(courseId);
      }
    }
  }, [updateExactCourseSummary]);

  const abortRequests = useCallback(() => {
    courseRequestRef.current?.abort();
    taskRequestControllers.current.forEach((controller) => controller.abort());
    taskRequestControllers.current.clear();
  }, []);

  useEffect(() => {
    loadCourses();
    return abortRequests;
  }, [abortRequests, loadCourses]);

  function clearActionMessages() {
    setActionError('');
    setFeedback('');
  }

  function toggleExpanded(courseId) {
    const opening = !expandedCourseIds.has(courseId);
    setExpandedCourseIds((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });

    const bucket = tasksByCourse[courseId];
    if (opening && !bucket?.loaded && bucket?.status !== 'loading') loadTasks(courseId);
  }

  function openCourseForm(course = null) {
    clearActionMessages();
    setFormError('');
    setFormDialog({ kind: 'course', course });
  }

  function openTaskForm(course, task = null) {
    clearActionMessages();
    setFormError('');
    setFormDialog({ kind: 'task', course, task });
  }

  function closeForm() {
    if (formSaving) return;
    setFormDialog(null);
    setFormError('');
  }

  async function submitCourse(body) {
    setFormSaving(true);
    setFormError('');

    try {
      if (formDialog.course) {
        const updated = await updateCourse(formDialog.course.id, body);
        setCourses((current) => current.map((course) => (
          course.id === updated.id ? { ...course, ...updated } : course
        )));
        setFeedback('Course updated successfully.');
      } else {
        const created = await createCourse(body);
        setCourses((current) => [{
          ...created,
          taskCount: 0,
          completedTaskCount: 0,
          progressPercentage: 0,
        }, ...current]);
        setFeedback('Course added successfully.');
      }
      setFormDialog(null);
    } catch (error) {
      setFormError(error?.message || 'The course could not be saved.');
    } finally {
      setFormSaving(false);
    }
  }

  function updateTaskBucket(courseId, updater) {
    setTasksByCourse((current) => {
      const existing = current[courseId] ?? { items: [], loaded: true, status: 'success' };
      return {
        ...current,
        [courseId]: {
          ...existing,
          items: sortTasks(updater(existing.items)),
          loaded: true,
          status: 'success',
          error: '',
        },
      };
    });
  }

  async function submitTask(body) {
    const { course, task } = formDialog;
    setFormSaving(true);
    setFormError('');

    try {
      if (task) {
        const updated = await updateTask(task.id, body);
        updateTaskBucket(course.id, (current) => current.map((item) => (
          item.id === updated.id ? updated : item
        )));
        const completedDelta = Number(updated.status === 'completed')
          - Number(task.status === 'completed');
        if (completedDelta) adjustCourseSummary(course.id, 0, completedDelta);
        setFeedback('Task updated successfully.');
      } else {
        const created = await createTask(course.id, body);
        updateTaskBucket(course.id, (current) => [
          created,
          ...current.filter((item) => item.id !== created.id),
        ]);
        adjustCourseSummary(course.id, 1, created.status === 'completed' ? 1 : 0);
        setFeedback('Task added successfully.');
      }
      setFormDialog(null);
    } catch (error) {
      setFormError(error?.message || 'The task could not be saved.');
    } finally {
      setFormSaving(false);
    }
  }

  async function toggleTask(task) {
    if (busyTaskIds.has(task.id)) return;
    clearActionMessages();
    updateBusySet(setBusyTaskIds, task.id, true);

    try {
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      const updated = await updateTask(task.id, { status: nextStatus });
      updateTaskBucket(task.courseId, (current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )));
      adjustCourseSummary(
        task.courseId,
        0,
        Number(updated.status === 'completed') - Number(task.status === 'completed'),
      );
      setFeedback(updated.status === 'completed' ? 'Task completed.' : 'Task reopened.');
    } catch (error) {
      setActionError(error?.message || 'The task status could not be changed.');
    } finally {
      updateBusySet(setBusyTaskIds, task.id, false);
    }
  }

  async function confirmDeletion() {
    if (!confirmation || deleting) return;

    setDeleting(true);
    setActionError('');

    if (confirmation.kind === 'course') {
      updateBusySet(setBusyCourseIds, confirmation.course.id, true);
    } else {
      updateBusySet(setBusyTaskIds, confirmation.task.id, true);
    }

    try {
      if (confirmation.kind === 'course') {
        const courseId = confirmation.course.id;
        await deleteCourse(courseId);
        taskRequestControllers.current.get(courseId)?.abort();
        taskRequestControllers.current.delete(courseId);
        setCourses((current) => current.filter((course) => course.id !== courseId));
        setTasksByCourse((current) => {
          const next = { ...current };
          delete next[courseId];
          return next;
        });
        setExpandedCourseIds((current) => {
          const next = new Set(current);
          next.delete(courseId);
          return next;
        });
        setFeedback('Course and its tasks deleted successfully.');
      } else {
        const { course, task } = confirmation;
        await deleteTask(task.id);
        updateTaskBucket(course.id, (current) => current.filter((item) => item.id !== task.id));
        adjustCourseSummary(course.id, -1, task.status === 'completed' ? -1 : 0);
        setFeedback('Task deleted successfully.');
      }
      setConfirmation(null);
    } catch (error) {
      setActionError(error?.message || 'The item could not be deleted.');
      setConfirmation(null);
    } finally {
      if (confirmation.kind === 'course') {
        updateBusySet(setBusyCourseIds, confirmation.course.id, false);
      } else {
        updateBusySet(setBusyTaskIds, confirmation.task.id, false);
      }
      setDeleting(false);
    }
  }

  const formTitle = formDialog?.kind === 'course'
    ? `${formDialog.course ? 'Edit' : 'Add'} course`
    : `${formDialog?.task ? 'Edit' : 'Add'} task`;

  return (
    <div className="courses-page" aria-busy={loading}>
      <header className="page-header courses-page__header">
        <div>
          <p className="page-header__eyebrow">Learning modules</p>
          <h1>My Courses</h1>
          <p>Organize course work into clear tasks and watch each module move forward.</p>
        </div>
        <button type="button" className="button button--primary" onClick={() => openCourseForm()} disabled={loading || Boolean(pageError)}>
          <Plus size={18} aria-hidden="true" /> Add Course
        </button>
      </header>

      {feedback && (
        <div className="alert alert--success courses-page__feedback" role="status">
          <span>{feedback}</span>
          <button type="button" className="alert__dismiss" onClick={() => setFeedback('')} aria-label="Dismiss success message">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="alert alert--error courses-page__feedback" role="alert">
          <TriangleAlert size={19} aria-hidden="true" />
          <span>{actionError}</span>
          <button type="button" className="alert__dismiss" onClick={() => setActionError('')} aria-label="Dismiss error message">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="page-loading-state" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          <p>Loading your courses…</p>
        </div>
      ) : pageError ? (
        <section className="empty-state empty-state--error" role="alert">
          <TriangleAlert size={38} aria-hidden="true" />
          <h2>Courses could not be loaded</h2>
          <p>{pageError}</p>
          <button type="button" className="button button--secondary" onClick={loadCourses}>
            <RefreshCw size={17} aria-hidden="true" /> Try again
          </button>
        </section>
      ) : courses.length ? (
        <section className="courses-page__modules" aria-label="Your courses">
          {courses.map((course, index) => (
            <CourseModule
              key={course.id}
              course={course}
              index={index}
              expanded={expandedCourseIds.has(course.id)}
              taskBucket={tasksByCourse[course.id]}
              courseBusy={busyCourseIds.has(course.id)}
              busyTaskIds={busyTaskIds}
              onToggleExpanded={toggleExpanded}
              onRetryTasks={loadTasks}
              onEditCourse={openCourseForm}
              onDeleteCourse={(selectedCourse) => {
                clearActionMessages();
                setConfirmation({ kind: 'course', course: selectedCourse });
              }}
              onAddTask={(selectedCourse) => openTaskForm(selectedCourse)}
              onEditTask={openTaskForm}
              onDeleteTask={(selectedCourse, selectedTask) => {
                clearActionMessages();
                setConfirmation({ kind: 'task', course: selectedCourse, task: selectedTask });
              }}
              onToggleTask={toggleTask}
            />
          ))}
        </section>
      ) : (
        <section className="empty-state courses-page__empty">
          <BookOpen size={44} aria-hidden="true" />
          <h2>Build your first course module</h2>
          <p>Add a course, then break the work into manageable tasks with deadlines and priorities.</p>
          <button type="button" className="button button--primary" onClick={() => openCourseForm()}>
            <Plus size={18} aria-hidden="true" /> Add your first course
          </button>
        </section>
      )}

      <Modal
        open={Boolean(formDialog)}
        title={formTitle}
        description={formDialog?.kind === 'task' ? `Course: ${formDialog.course.title}` : undefined}
        onClose={closeForm}
        busy={formSaving}
      >
        {formDialog?.kind === 'course' && (
          <CourseForm
            key={`course-${formDialog.course?.id ?? 'new'}`}
            course={formDialog.course}
            onSubmit={submitCourse}
            onCancel={closeForm}
            saving={formSaving}
            serverError={formError}
            onClearError={() => setFormError('')}
          />
        )}
        {formDialog?.kind === 'task' && (
          <TaskForm
            key={`task-${formDialog.task?.id ?? 'new'}-${formDialog.course.id}`}
            task={formDialog.task}
            onSubmit={submitTask}
            onCancel={closeForm}
            saving={formSaving}
            serverError={formError}
            onClearError={() => setFormError('')}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.kind === 'course' ? 'Delete course?' : 'Delete task?'}
        message={confirmation?.kind === 'course'
          ? `Delete “${confirmation.course.title}”? All tasks in this course will also be deleted.`
          : `Delete “${confirmation?.task?.title}”? This action cannot be undone.`}
        confirmLabel={confirmation?.kind === 'course' ? 'Delete course' : 'Delete task'}
        onConfirm={confirmDeletion}
        onCancel={() => !deleting && setConfirmation(null)}
        busy={deleting}
      />
    </div>
  );
}
