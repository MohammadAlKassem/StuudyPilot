import Button from './Button.jsx';
import Modal from './Modal.jsx';

function ConfirmDialog({
  confirmLabel = 'Confirm',
  loading = false,
  message,
  onCancel,
  onConfirm,
  open,
  title = 'Are you sure?',
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      busy={loading}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            loadingText="Working…"
          >
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}

export default ConfirmDialog;
