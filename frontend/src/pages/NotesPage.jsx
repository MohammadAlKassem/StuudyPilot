import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';

import {
  createNote,
  deleteNote,
  getNote,
  getNotes,
  updateNote,
} from '../api/noteApi.js';
import { formatDateTime } from '../utils/date.js';

const EMPTY_FORM = { title: '', content: '' };

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function Modal({ title, description, busy = false, onClose, children }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    document.body.style.overflow = 'hidden';
    const focusable = dialog?.querySelector('[data-modal-initial-focus]')
      ?? dialog?.querySelector(focusableSelector);
    focusable?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll(focusableSelector)];
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const fallback = document.querySelector('#main-content button:not([disabled]), #main-content a[href]');
      (previouslyFocused?.isConnected ? previouslyFocused : fallback)?.focus?.();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="presentation"
    >
      <section
        ref={dialogRef}
        className="modal notes-page__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function NotesPage() {
  const requestSequence = useRef(0);
  const editRequestRef = useRef(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingNoteId, setLoadingNoteId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadNotes = useCallback(async ({ signal } = {}) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setPageError('');

    try {
      const result = await getNotes({ signal });
      if (requestId === requestSequence.current) {
        setNotes(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && requestId === requestSequence.current) {
        setPageError(getErrorMessage(error, 'Could not load your notes.'));
      }
    } finally {
      if (!signal?.aborted && requestId === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadNotes({ signal: controller.signal });
    return () => {
      controller.abort();
      editRequestRef.current?.abort();
      requestSequence.current += 1;
    };
  }, [loadNotes]);

  function openCreateForm() {
    editRequestRef.current?.abort();
    editRequestRef.current = null;
    setLoadingNoteId(null);
    setEditingNote(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setActionError('');
    setSuccessMessage('');
    setFormOpen(true);
  }

  async function openEditForm(note) {
    editRequestRef.current?.abort();
    const controller = new AbortController();
    editRequestRef.current = controller;
    setLoadingNoteId(note.id);
    setActionError('');
    setSuccessMessage('');

    try {
      const freshNote = await getNote(note.id, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setEditingNote(freshNote);
        setForm({ title: freshNote.title ?? '', content: freshNote.content ?? '' });
        setFieldErrors({});
        setFormOpen(true);
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && !controller.signal.aborted) {
        setActionError(getErrorMessage(error, 'Could not open this note.'));
      }
    } finally {
      if (editRequestRef.current === controller) {
        editRequestRef.current = null;
        setLoadingNoteId(null);
      }
    }
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingNote(null);
    setFieldErrors({});
    setActionError('');
  }

  function validateForm() {
    const errors = {};
    const title = form.title.trim();
    const content = form.content.trim();

    if (!title) errors.title = 'Enter a note title.';
    else if (title.length > 150) errors.title = 'Title must not exceed 150 characters.';

    if (!content) errors.content = 'Enter some note content.';
    else if (content.length > 50000) {
      errors.content = 'Content must not exceed 50,000 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    if (!validateForm()) {
      const formElement = event.currentTarget;
      window.requestAnimationFrame(() => formElement.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    setSaving(true);
    setActionError('');
    setSuccessMessage('');
    const body = { title: form.title.trim(), content: form.content.trim() };

    try {
      if (editingNote) {
        const updated = await updateNote(editingNote.id, body);
        setNotes((current) => current.map((note) => (
          note.id === updated.id ? updated : note
        )));
        setSuccessMessage('Note updated successfully.');
      } else {
        const created = await createNote(body);
        setNotes((current) => [created, ...current.filter((note) => note.id !== created.id)]);
        setSuccessMessage('Note created successfully.');
      }
      setFormOpen(false);
      setEditingNote(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not save the note.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    const noteId = deleteTarget.id;
    setDeleting(true);
    setActionError('');
    setSuccessMessage('');

    try {
      await deleteNote(noteId);
      setNotes((current) => current.filter((note) => note.id !== noteId));
      setDeleteTarget(null);
      setSuccessMessage('Note deleted successfully.');
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not delete the note.'));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-shell notes-page">
      <header className="page-header notes-page__header">
        <div>
          <p className="page-header__eyebrow">Capture ideas as you study</p>
          <h1>Quick Notes</h1>
          <p>Keep short reminders, explanations, and revision points in one place.</p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={openCreateForm}
          disabled={loading || Boolean(pageError) || loadingNoteId !== null}
        >
          <Plus aria-hidden="true" />
          Add Note
        </button>
      </header>

      <div className="feedback-region" aria-live="polite" aria-atomic="true">
        {successMessage ? (
          <div className="alert alert--success" role="status">
            <CheckCircle2 aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
        ) : null}
        {actionError && !formOpen ? (
          <div className="alert alert--error" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="loading-state" role="status">
          <LoaderCircle className="spin" aria-hidden="true" />
          <span>Loading your notes...</span>
        </div>
      ) : pageError ? (
        <section className="empty-state empty-state--error" role="alert">
          <AlertCircle aria-hidden="true" />
          <h2>Notes could not be loaded</h2>
          <p>{pageError}</p>
          <button type="button" className="button button--secondary" onClick={loadNotes}>
            <RefreshCw aria-hidden="true" />
            Try Again
          </button>
        </section>
      ) : notes.length === 0 ? (
        <section className="empty-state notes-page__empty">
          <FileText aria-hidden="true" />
          <h2>No notes yet</h2>
          <p>Create your first quick note for something worth remembering.</p>
          <button type="button" className="button button--primary" onClick={openCreateForm}>
            <Plus aria-hidden="true" />
            Create a Note
          </button>
        </section>
      ) : (
        <section className="notes-page__grid" aria-label="Your notes">
          {notes.map((note) => (
            <article className="note-card" key={note.id}>
              <div className="note-card__heading">
                <div className="note-card__icon" aria-hidden="true">
                  <FileText />
                </div>
                <div className="note-card__actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => openEditForm(note)}
                    disabled={loadingNoteId !== null}
                    aria-label={`Edit ${note.title}`}
                  >
                    {loadingNoteId === note.id ? (
                      <LoaderCircle className="spin" aria-hidden="true" />
                    ) : (
                      <Pencil aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    onClick={() => {
                      setActionError('');
                      setSuccessMessage('');
                      setDeleteTarget(note);
                    }}
                    disabled={loadingNoteId !== null}
                    aria-label={`Delete ${note.title}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              </div>
              <h2>{note.title}</h2>
              <p className="note-card__content">{note.content}</p>
              <div className="note-card__date">
                <Clock3 aria-hidden="true" />
                <span>
                  {note.updatedAt && note.updatedAt !== note.createdAt ? 'Updated' : 'Created'}{' '}
                  {formatDateTime(note.updatedAt || note.createdAt)}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}

      {formOpen ? (
        <Modal
          title={editingNote ? 'Edit Note' : 'Add Note'}
          description={editingNote
            ? 'Update the title or content, then save your changes.'
            : 'Add a title and the information you want to remember.'}
          busy={saving}
          onClose={closeForm}
        >
          <form className="form-stack notes-page__form" onSubmit={handleSubmit} noValidate>
            {actionError ? (
              <div className="alert alert--error" role="alert">
                <AlertCircle aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}
            <div className="form-field">
              <label htmlFor="note-title">Title</label>
              <input
                id="note-title"
                type="text"
                value={form.title}
                onChange={(event) => {
                  setForm((current) => ({ ...current, title: event.target.value }));
                  setFieldErrors((current) => ({ ...current, title: '' }));
                  setActionError('');
                }}
                maxLength={150}
                required
                disabled={saving}
                data-modal-initial-focus="true"
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? 'note-title-error' : undefined}
              />
              <div className="form-field__meta">
                {fieldErrors.title ? (
                  <span id="note-title-error" className="field-error">{fieldErrors.title}</span>
                ) : <span />}
                <span>{form.title.length}/150</span>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="note-content">Content</label>
              <textarea
                id="note-content"
                rows={9}
                value={form.content}
                onChange={(event) => {
                  setForm((current) => ({ ...current, content: event.target.value }));
                  setFieldErrors((current) => ({ ...current, content: '' }));
                  setActionError('');
                }}
                maxLength={50000}
                required
                disabled={saving}
                aria-invalid={Boolean(fieldErrors.content)}
                aria-describedby={fieldErrors.content ? 'note-content-error' : undefined}
              />
              <div className="form-field__meta">
                {fieldErrors.content ? (
                  <span id="note-content-error" className="field-error">{fieldErrors.content}</span>
                ) : <span />}
                <span>{form.content.length.toLocaleString()}/50,000</span>
              </div>
            </div>

            <div className="modal__actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="button button--primary" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="spin" aria-hidden="true" />
                ) : (
                  <Save aria-hidden="true" />
                )}
                {saving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal
          title="Delete Note?"
          description="This action permanently removes the note."
          busy={deleting}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="confirm-dialog__body">
            <div className="confirm-dialog__icon confirm-dialog__icon--danger" aria-hidden="true">
              <Trash2 />
            </div>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>?
            </p>
          </div>
          <div className="modal__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              data-modal-initial-focus="true"
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              {deleting ? 'Deleting...' : 'Delete Note'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
