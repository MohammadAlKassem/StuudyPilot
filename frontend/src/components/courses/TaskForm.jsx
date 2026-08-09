import { useId, useState } from 'react';
import { localDateTimeToIso, toDateTimeLocalValue } from '../../utils/date';
import { hasValidationErrors, validateTask } from '../../utils/validation';

export default function TaskForm({
  task,
  onSubmit,
  onCancel,
  saving = false,
  serverError = '',
  onClearError,
}) {
  const formId = useId();
  const isEditing = Boolean(task);
  const [values, setValues] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    deadline: toDateTimeLocalValue(task?.deadline),
    priority: task?.priority ?? 'medium',
    status: task?.status ?? 'pending',
  });
  const [errors, setErrors] = useState({});

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    onClearError?.();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const nextErrors = validateTask(values, { isEditing });
    setErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      const form = event.currentTarget;
      window.requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    const body = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      deadline: values.deadline ? localDateTimeToIso(values.deadline) : null,
      priority: values.priority,
    };
    if (isEditing) body.status = values.status;

    await onSubmit(body);
  }

  function fieldProps(field) {
    const errorId = errors[field] ? `${formId}-${field}-error` : undefined;
    return {
      'aria-invalid': Boolean(errors[field]),
      'aria-describedby': errorId,
    };
  }

  return (
    <form className="entity-form task-form" onSubmit={handleSubmit} noValidate>
      {serverError && <div className="alert alert--error" role="alert">{serverError}</div>}

      <div className="form-field task-form__full-width">
        <label htmlFor={`${formId}-title`}>Task title</label>
        <input
          id={`${formId}-title`}
          type="text"
          value={values.title}
          maxLength={150}
          required
          onChange={(event) => updateField('title', event.target.value)}
          disabled={saving}
          autoFocus
          data-modal-initial-focus="true"
          {...fieldProps('title')}
        />
        <div className="form-field__meta">
          {errors.title ? (
            <span id={`${formId}-title-error`} className="field-error">{errors.title}</span>
          ) : <span />}
          <span>{values.title.length}/150</span>
        </div>
      </div>

      <div className="form-field task-form__full-width">
        <label htmlFor={`${formId}-description`}>Description <span className="form-field__optional">Optional</span></label>
        <textarea
          id={`${formId}-description`}
          rows={4}
          value={values.description}
          maxLength={65535}
          onChange={(event) => updateField('description', event.target.value)}
          disabled={saving}
          {...fieldProps('description')}
        />
        {errors.description && (
          <span id={`${formId}-description-error`} className="field-error">{errors.description}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor={`${formId}-deadline`}>Deadline <span className="form-field__optional">Optional</span></label>
        <input
          id={`${formId}-deadline`}
          type="datetime-local"
          value={values.deadline}
          onChange={(event) => updateField('deadline', event.target.value)}
          disabled={saving}
          {...fieldProps('deadline')}
        />
        {errors.deadline && (
          <span id={`${formId}-deadline-error`} className="field-error">{errors.deadline}</span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor={`${formId}-priority`}>Priority</label>
        <select
          id={`${formId}-priority`}
          value={values.priority}
          onChange={(event) => updateField('priority', event.target.value)}
          disabled={saving}
          {...fieldProps('priority')}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        {errors.priority && (
          <span id={`${formId}-priority-error`} className="field-error">{errors.priority}</span>
        )}
      </div>

      {isEditing && (
        <div className="form-field task-form__full-width">
          <label htmlFor={`${formId}-status`}>Status</label>
          <select
            id={`${formId}-status`}
            value={values.status}
            onChange={(event) => updateField('status', event.target.value)}
            disabled={saving}
            {...fieldProps('status')}
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
          {errors.status && (
            <span id={`${formId}-status-error`} className="field-error">{errors.status}</span>
          )}
        </div>
      )}

      <div className="form-actions task-form__full-width">
        <button type="button" className="button button--secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </form>
  );
}
