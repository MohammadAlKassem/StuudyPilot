import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

const ICONS = {
  danger: AlertCircle,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
};

function Alert({ children, type = 'info', onDismiss, title }) {
  const Icon = ICONS[type] || Info;

  return (
    <div className={`alert alert--${type}`} role={type === 'danger' ? 'alert' : 'status'}>
      <Icon className="alert__icon" size={19} aria-hidden="true" />
      <div className="alert__content">
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="icon-button alert__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <X size={17} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default Alert;
