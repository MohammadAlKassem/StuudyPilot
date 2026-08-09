export default function CourseProgress({ value, completedCount, totalCount, courseTitle }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div className="course-progress">
      <div className="course-progress__labels">
        <span>{completedCount} of {totalCount} tasks completed</span>
        <strong>{safeValue}%</strong>
      </div>
      <progress
        className="course-progress__bar"
        value={safeValue}
        max="100"
        aria-label={`${courseTitle || 'Course'} progress: ${safeValue}% complete`}
      >
        {safeValue}%
      </progress>
    </div>
  );
}
