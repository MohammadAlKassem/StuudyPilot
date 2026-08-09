import { Inbox } from 'lucide-react';

function EmptyState({ action, description, icon: Icon = Inbox, title }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Icon size={26} aria-hidden="true" /></span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
