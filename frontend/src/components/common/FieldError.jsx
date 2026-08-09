function FieldError({ children, id }) {
  if (!children) return null;
  return <span className="field-error" id={id}>{children}</span>;
}

export default FieldError;
