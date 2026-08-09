function StatusBadge({ children, status = 'neutral' }) {
  return <span className={`status-badge status-badge--${status}`}>{children}</span>;
}

export default StatusBadge;
