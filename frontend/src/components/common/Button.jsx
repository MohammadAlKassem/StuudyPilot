import { LoaderCircle } from 'lucide-react';

function Button({
  children,
  className = '',
  icon: Icon,
  loading = false,
  loadingText = 'Please wait…',
  size = 'medium',
  variant = 'primary',
  ...props
}) {
  return (
    <button
      type="button"
      className={`button button--${variant} button--${size} ${className}`.trim()}
      {...props}
      disabled={loading || props.disabled}
    >
      {loading ? (
        <LoaderCircle className="spin" size={18} aria-hidden="true" />
      ) : Icon ? (
        <Icon size={18} aria-hidden="true" />
      ) : null}
      <span>{loading ? loadingText : children}</span>
    </button>
  );
}

export default Button;
