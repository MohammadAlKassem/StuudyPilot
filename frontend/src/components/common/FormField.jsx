import FieldError from './FieldError.jsx';

function FormField({ children, error, hint, id, label, required = false }) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <span className="field-hint" id={hintId}>{hint}</span>}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

export default FormField;
