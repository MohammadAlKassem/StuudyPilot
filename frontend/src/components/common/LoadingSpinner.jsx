import { LoaderCircle } from 'lucide-react';

function LoadingSpinner({ label = 'Loading…', page = false }) {
  return (
    <div className={`loading-state${page ? ' loading-state--page' : ''}`} role="status">
      <LoaderCircle className="spin" size={24} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export default LoadingSpinner;
