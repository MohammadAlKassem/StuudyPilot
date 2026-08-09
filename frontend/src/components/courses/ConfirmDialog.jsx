import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  busy = false,
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel} busy={busy}>
      <div className="confirm-dialog__message">
        <span className="confirm-dialog__icon" aria-hidden="true">
          <AlertTriangle size={24} />
        </span>
        <p>{message}</p>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={onCancel}
          disabled={busy}
          data-modal-initial-focus="true"
        >
          Cancel
        </button>
        <button type="button" className="button button--danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Deleting…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
