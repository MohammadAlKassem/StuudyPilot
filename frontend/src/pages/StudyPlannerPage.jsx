import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  History,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import {
  deleteStudyPlan,
  generateStudyPlan,
  getStudyPlan,
  getStudyPlans,
} from '../api/studyPlanApi.js';
import { formatDateTime, localDateTimeToIso } from '../utils/date.js';

const EMPTY_FORM = {
  subject: '',
  topic: '',
  difficulty: 'medium',
  availableMinutes: '60',
  deadline: '',
};

const DIFFICULTIES = ['easy', 'medium', 'hard'];

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAiUnavailable(error) {
  const status = Number(error?.status ?? error?.statusCode);
  return status === 503 || String(error?.code || '').startsWith('AI_');
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Not specified';
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
    const selector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    document.body.style.overflow = 'hidden';
    (dialog?.querySelector('[data-modal-initial-focus]')
      ?? dialog?.querySelector(selector))?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;
      const controls = [...dialog.querySelectorAll(selector)];
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
        className="modal study-planner__modal"
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

function PlanMetadata({ plan }) {
  return (
    <dl className="study-plan-card__metadata">
      <div>
        <dt>Difficulty</dt>
        <dd><span className={`status-badge status-badge--${plan.difficulty}`}>{capitalize(plan.difficulty)}</span></dd>
      </div>
      <div>
        <dt><Clock3 aria-hidden="true" /> Available time</dt>
        <dd>{plan.availableMinutes} minutes</dd>
      </div>
      <div>
        <dt><CalendarDays aria-hidden="true" /> Deadline</dt>
        <dd>{plan.deadline ? formatDateTime(plan.deadline) : 'No deadline'}</dd>
      </div>
      <div>
        <dt>Created</dt>
        <dd>{formatDateTime(plan.createdAt)}</dd>
      </div>
    </dl>
  );
}

export default function StudyPlannerPage() {
  const historyRequestSequence = useRef(0);
  const detailsRequestRef = useRef(null);
  const [plans, setPlans] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [generationError, setGenerationError] = useState('');
  const [aiUnavailableMessage, setAiUnavailableMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);

  const loadPlans = useCallback(async ({ signal } = {}) => {
    const requestId = ++historyRequestSequence.current;
    setHistoryLoading(true);
    setHistoryError('');

    try {
      const result = await getStudyPlans({ signal });
      if (requestId === historyRequestSequence.current && !signal?.aborted) {
        setPlans(Array.isArray(result) ? result : []);
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && requestId === historyRequestSequence.current) {
        setHistoryError(getErrorMessage(error, 'Could not load your saved study plans.'));
      }
    } finally {
      if (!signal?.aborted && requestId === historyRequestSequence.current) {
        setHistoryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadPlans({ signal: controller.signal });
    return () => {
      controller.abort();
      detailsRequestRef.current?.abort();
      historyRequestSequence.current += 1;
    };
  }, [loadPlans]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setGenerationError('');
    setAiUnavailableMessage('');
  }

  function validateForm() {
    const errors = {};
    const subject = form.subject.trim();
    const topic = form.topic.trim();
    const minutes = Number(form.availableMinutes);

    if (!subject) errors.subject = 'Enter a subject.';
    else if (subject.length > 100) errors.subject = 'Subject must not exceed 100 characters.';

    if (!topic) errors.topic = 'Enter a topic.';
    else if (topic.length > 150) errors.topic = 'Topic must not exceed 150 characters.';

    if (!DIFFICULTIES.includes(form.difficulty)) {
      errors.difficulty = 'Choose a valid difficulty.';
    }

    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 480) {
      errors.availableMinutes = 'Enter a whole number from 15 to 480.';
    }

    if (form.deadline) {
      try {
        if (!localDateTimeToIso(form.deadline)) {
          errors.deadline = 'Enter a valid deadline.';
        }
      } catch {
        errors.deadline = 'Enter a valid deadline.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleGenerate(event) {
    event.preventDefault();
    if (generating) return;
    if (!validateForm()) {
      const formElement = event.currentTarget;
      window.requestAnimationFrame(() => formElement.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    const deadline = form.deadline ? localDateTimeToIso(form.deadline) : null;
    const body = {
      subject: form.subject.trim(),
      topic: form.topic.trim(),
      difficulty: form.difficulty,
      availableMinutes: Number(form.availableMinutes),
      deadline,
    };

    setGenerating(true);
    setGenerationError('');
    setAiUnavailableMessage('');
    setActionError('');
    setSuccessMessage('');

    try {
      const created = await generateStudyPlan(body);
      historyRequestSequence.current += 1;
      setHistoryLoading(false);
      setHistoryError('');
      setGeneratedPlan(created);
      setPlans((current) => [created, ...current.filter((plan) => plan.id !== created.id)]);
      setSuccessMessage('Your study plan was generated and saved.');
    } catch (error) {
      setGeneratedPlan(null);
      if (isAiUnavailable(error)) {
        setAiUnavailableMessage(
          getErrorMessage(
            error,
            'AI generation is not configured yet. Your other StudyPilot features are still available.',
          ),
        );
      } else {
        setGenerationError(getErrorMessage(error, 'Could not generate a study plan.'));
      }
    } finally {
      setGenerating(false);
    }
  }

  async function openPlanDetails(plan) {
    detailsRequestRef.current?.abort();
    const controller = new AbortController();
    detailsRequestRef.current = controller;
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError('');
    setSelectedPlan(null);

    try {
      const result = await getStudyPlan(plan.id, { signal: controller.signal });
      if (!controller.signal.aborted) setSelectedPlan(result);
    } catch (error) {
      if (error?.name !== 'AbortError' && !controller.signal.aborted) {
        setDetailsError(getErrorMessage(error, 'Could not load this study plan.'));
      }
    } finally {
      if (detailsRequestRef.current === controller) {
        detailsRequestRef.current = null;
        setDetailsLoading(false);
      }
    }
  }

  function closeDetails() {
    detailsRequestRef.current?.abort();
    detailsRequestRef.current = null;
    setDetailsLoading(false);
    setDetailsOpen(false);
    setSelectedPlan(null);
    setDetailsError('');
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    const planId = deleteTarget.id;
    setDeleting(true);
    setActionError('');
    setSuccessMessage('');

    try {
      await deleteStudyPlan(planId);
      historyRequestSequence.current += 1;
      setHistoryLoading(false);
      setPlans((current) => current.filter((plan) => plan.id !== planId));
      setGeneratedPlan((current) => (current?.id === planId ? null : current));
      if (selectedPlan?.id === planId) closeDetails();
      setDeleteTarget(null);
      setSuccessMessage('Saved study plan deleted successfully.');
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not delete the study plan.'));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-shell study-planner">
      <header className="page-header study-planner__header">
        <div>
          <p className="page-header__eyebrow">Focused learning, planned for you</p>
          <h1>AI Study Planner</h1>
          <p>Describe what you need to learn and StudyPilot will build a timed plan.</p>
        </div>
        <div className="study-planner__header-icon" aria-hidden="true">
          <Sparkles />
        </div>
      </header>

      <div className="feedback-region" aria-live="polite" aria-atomic="true">
        {successMessage ? (
          <div className="alert alert--success" role="status">
            <CheckCircle2 aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
        ) : null}
        {actionError ? (
          <div className="alert alert--error" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        ) : null}
      </div>

      <section className="surface-card study-planner__generator" aria-labelledby="planner-form-title">
        <div className="section-heading">
          <div className="section-heading__icon" aria-hidden="true"><Sparkles /></div>
          <div>
            <h2 id="planner-form-title">Generate a New Plan</h2>
            <p>Give the planner enough context to divide your time effectively.</p>
          </div>
        </div>

        <form className="study-planner__form" onSubmit={handleGenerate} noValidate>
          <div className="form-field">
            <label htmlFor="planner-subject">Subject</label>
            <input
              id="planner-subject"
              type="text"
              placeholder="e.g. Web Development"
              value={form.subject}
              onChange={(event) => updateField('subject', event.target.value)}
              maxLength={100}
              required
              disabled={generating}
              aria-invalid={Boolean(fieldErrors.subject)}
              aria-describedby={fieldErrors.subject ? 'planner-subject-error' : undefined}
            />
            {fieldErrors.subject ? (
              <span id="planner-subject-error" className="field-error">{fieldErrors.subject}</span>
            ) : null}
          </div>

          <div className="form-field study-planner__topic-field">
            <label htmlFor="planner-topic">Topic</label>
            <input
              id="planner-topic"
              type="text"
              placeholder="e.g. Promises and async/await"
              value={form.topic}
              onChange={(event) => updateField('topic', event.target.value)}
              maxLength={150}
              required
              disabled={generating}
              aria-invalid={Boolean(fieldErrors.topic)}
              aria-describedby={fieldErrors.topic ? 'planner-topic-error' : undefined}
            />
            {fieldErrors.topic ? (
              <span id="planner-topic-error" className="field-error">{fieldErrors.topic}</span>
            ) : null}
          </div>

          <div className="form-field">
            <label htmlFor="planner-difficulty">Difficulty</label>
            <select
              id="planner-difficulty"
              value={form.difficulty}
              onChange={(event) => updateField('difficulty', event.target.value)}
              disabled={generating}
              required
              aria-invalid={Boolean(fieldErrors.difficulty)}
              aria-describedby={fieldErrors.difficulty ? 'planner-difficulty-error' : undefined}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            {fieldErrors.difficulty ? (
              <span id="planner-difficulty-error" className="field-error">{fieldErrors.difficulty}</span>
            ) : null}
          </div>

          <div className="form-field">
            <label htmlFor="planner-minutes">Available Minutes</label>
            <input
              id="planner-minutes"
              type="number"
              min="15"
              max="480"
              step="1"
              required
              value={form.availableMinutes}
              onChange={(event) => updateField('availableMinutes', event.target.value)}
              disabled={generating}
              aria-invalid={Boolean(fieldErrors.availableMinutes)}
              aria-describedby={fieldErrors.availableMinutes ? 'planner-minutes-error' : 'planner-minutes-hint'}
            />
            {fieldErrors.availableMinutes ? (
              <span id="planner-minutes-error" className="field-error">{fieldErrors.availableMinutes}</span>
            ) : (
              <span id="planner-minutes-hint" className="field-hint">Between 15 and 480 minutes.</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="planner-deadline">Deadline <span>(optional)</span></label>
            <input
              id="planner-deadline"
              type="datetime-local"
              value={form.deadline}
              onChange={(event) => updateField('deadline', event.target.value)}
              disabled={generating}
              aria-invalid={Boolean(fieldErrors.deadline)}
              aria-describedby={fieldErrors.deadline ? 'planner-deadline-error' : undefined}
            />
            {fieldErrors.deadline ? (
              <span id="planner-deadline-error" className="field-error">{fieldErrors.deadline}</span>
            ) : null}
          </div>

          <div className="study-planner__submit">
            <button type="submit" className="button button--primary" disabled={generating}>
              {generating ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {generating ? 'Generating your study plan...' : 'Generate Study Plan'}
            </button>
          </div>
        </form>

        {generationError ? (
          <div className="alert alert--error study-planner__form-feedback" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{generationError}</span>
          </div>
        ) : null}

        {aiUnavailableMessage ? (
          <div className="ai-unavailable" role="status">
            <div className="ai-unavailable__icon" aria-hidden="true"><AlertCircle /></div>
            <div>
              <h3>AI planning is currently unavailable</h3>
              <p>{aiUnavailableMessage}</p>
              <p>Your courses, tasks, and notes are still available.</p>
            </div>
          </div>
        ) : null}
      </section>

      {generatedPlan ? (
        <section className="surface-card generated-plan" aria-labelledby="generated-plan-title">
          <div className="generated-plan__heading">
            <div>
              <span className="status-badge status-badge--success">
                <CheckCircle2 aria-hidden="true" /> Saved
              </span>
              <h2 id="generated-plan-title">{generatedPlan.subject}: {generatedPlan.topic}</h2>
            </div>
            <button
              type="button"
              className="icon-button icon-button--danger"
              onClick={() => setDeleteTarget(generatedPlan)}
              aria-label="Delete generated study plan"
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
          <PlanMetadata plan={generatedPlan} />
          <div className="study-plan-card__content generated-plan__content">
            {generatedPlan.generatedPlan}
          </div>
        </section>
      ) : null}

      <section className="study-planner__history" aria-labelledby="saved-plans-title">
        <div className="section-heading section-heading--with-action">
          <div className="section-heading__title">
            <div className="section-heading__icon" aria-hidden="true"><History /></div>
            <div>
              <h2 id="saved-plans-title">Saved Plans</h2>
              <p>Review plans generated during earlier study sessions.</p>
            </div>
          </div>
          {!historyLoading ? (
            <button type="button" className="button button--ghost" onClick={() => loadPlans()}>
              <RefreshCw aria-hidden="true" /> Refresh
            </button>
          ) : null}
        </div>

        {historyLoading ? (
          <div className="loading-state" role="status">
            <LoaderCircle className="spin" aria-hidden="true" />
            <span>Loading saved plans...</span>
          </div>
        ) : historyError ? (
          <div className="empty-state empty-state--error" role="alert">
            <AlertCircle aria-hidden="true" />
            <h3>Saved plans could not be loaded</h3>
            <p>{historyError}</p>
            <button type="button" className="button button--secondary" onClick={() => loadPlans()}>
              <RefreshCw aria-hidden="true" /> Try Again
            </button>
          </div>
        ) : plans.length === 0 ? (
          <div className="empty-state">
            <BookOpen aria-hidden="true" />
            <h3>No saved study plans</h3>
            <p>Complete the form above to generate your first plan.</p>
          </div>
        ) : (
          <div className="study-planner__plan-list">
            {plans.map((plan) => (
              <article className="surface-card study-plan-card" key={plan.id}>
                <div className="study-plan-card__heading">
                  <div>
                    <p className="study-plan-card__subject">{plan.subject}</p>
                    <h3>{plan.topic}</h3>
                  </div>
                  <div className="study-plan-card__actions">
                    <button
                      type="button"
                      className="button button--secondary button--compact"
                      onClick={() => openPlanDetails(plan)}
                      aria-label={`View details for ${plan.subject}: ${plan.topic}`}
                    >
                      <Eye aria-hidden="true" /> View Details
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      onClick={() => {
                        setActionError('');
                        setSuccessMessage('');
                        setDeleteTarget(plan);
                      }}
                      aria-label={`Delete study plan for ${plan.topic}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <PlanMetadata plan={plan} />
                <div className="study-plan-card__content">{plan.generatedPlan}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      {detailsOpen ? (
        <Modal
          title={selectedPlan ? `${selectedPlan.subject}: ${selectedPlan.topic}` : 'Study Plan Details'}
          description="Your saved AI-generated study plan."
          onClose={closeDetails}
        >
          {detailsLoading ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" aria-hidden="true" />
              <span>Loading plan details...</span>
            </div>
          ) : detailsError ? (
            <div className="alert alert--error" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>{detailsError}</span>
            </div>
          ) : selectedPlan ? (
            <div className="study-plan-details">
              <PlanMetadata plan={selectedPlan} />
              <div className="study-plan-card__content">{selectedPlan.generatedPlan}</div>
              <div className="modal__actions">
                <button type="button" className="button button--secondary" onClick={closeDetails}>
                  Close
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => {
                    setDeleteTarget(selectedPlan);
                    setDetailsOpen(false);
                  }}
                >
                  <Trash2 aria-hidden="true" /> Delete Plan
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal
          title="Delete Saved Plan?"
          description="AI-generated plans cannot be recovered after deletion."
          busy={deleting}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="confirm-dialog__body">
            <div className="confirm-dialog__icon confirm-dialog__icon--danger" aria-hidden="true">
              <Trash2 />
            </div>
            <p>
              Delete the plan for <strong>{deleteTarget.topic}</strong>?
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
              {deleting ? 'Deleting...' : 'Delete Plan'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
