import { useId, useState } from 'react';
import { hasValidationErrors, validateCourse } from '../../utils/validation';

export default function CourseForm({
  course,
  onSubmit,
  onCancel,
  saving = false,
  serverError = '',
  onClearError,
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [title, setTitle] = useState(course?.title ?? '');
  const [errors, setErrors] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const nextErrors = validateCourse({ title });
    setErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      const form = event.currentTarget;
      window.requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    await onSubmit({ title: title.trim() });
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit} noValidate>
      {serverError && <div className="alert alert--error" role="alert">{serverError}</div>}
      <div className="form-field">
        <label htmlFor={inputId}>Course title</label>
        <input
          id={inputId}
          type="text"
          value={title}
          maxLength={100}
          required
          autoComplete="off"
          onChange={(event) => {
            setTitle(event.target.value);
            setErrors({});
            onClearError?.();
          }}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? errorId : undefined}
          disabled={saving}
          autoFocus
          data-modal-initial-focus="true"
        />
        <div className="form-field__meta">
          {errors.title ? (
            <span id={errorId} className="field-error">{errors.title}</span>
          ) : <span />}
          <span>{title.length}/100</span>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="button button--secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? 'Saving…' : course ? 'Save changes' : 'Add course'}
        </button>
      </div>
    </form>
  );
}
