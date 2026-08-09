import { isOverdue, isUpcoming, parseApiDate } from './date';

export function calculateProgress(tasks = []) {
  if (!tasks.length) return 0;

  const completed = tasks.filter((task) => task.status === 'completed').length;
  return Math.round((completed / tasks.length) * 100);
}

export function summarizeTasks(tasks = [], now = new Date()) {
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const pendingTasks = tasks.length - completedTasks;

  return {
    totalTasks: tasks.length,
    pendingTasks,
    completedTasks,
    upcomingTasks: tasks.filter((task) => (
      isUpcoming(task.deadline, task.status, now)
    )).length,
    overdueTasks: tasks.filter((task) => (
      isOverdue(task.deadline, task.status, now)
    )).length,
    progressPercentage: calculateProgress(tasks),
  };
}

function timestamp(value, fallback) {
  const date = parseApiDate(value);
  return date ? date.getTime() : fallback;
}

export function sortTasks(tasks = []) {
  return [...tasks].sort((first, second) => {
    const firstCompleted = first.status === 'completed' ? 1 : 0;
    const secondCompleted = second.status === 'completed' ? 1 : 0;
    if (firstCompleted !== secondCompleted) return firstCompleted - secondCompleted;

    const firstDeadline = timestamp(first.deadline, Number.POSITIVE_INFINITY);
    const secondDeadline = timestamp(second.deadline, Number.POSITIVE_INFINITY);
    if (firstDeadline !== secondDeadline) return firstDeadline - secondDeadline;

    const firstCreated = timestamp(first.createdAt, 0);
    const secondCreated = timestamp(second.createdAt, 0);
    if (firstCreated !== secondCreated) return secondCreated - firstCreated;

    return Number(second.id) - Number(first.id);
  });
}

