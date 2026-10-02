import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiRequest, ApiError } from '../../services/api/request';
import {
  formatSupportDate,
  issueTypeLabels,
  statusLabels,
  type SupportIssueType,
  type SupportMessage,
} from './support.types';
import './support.css';

function SupportRequestHistory() {
  const location = useLocation();
  const [requests, setRequests] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    void apiRequest<{ messages: SupportMessage[] }>('/trainee/support/messages')
      .then(({ messages }) => {
        if (mounted) setRequests(messages);
      })
      .catch(() => {
        if (mounted) setError('Your support requests could not be loaded.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (location.hash.startsWith('#support-request-'))
      document.getElementById(location.hash.slice(1))?.scrollIntoView({
        block: 'center',
      });
  }, [location.hash, requests]);

  return (
    <section
      className="support-request-history"
      aria-labelledby="support-request-history-title"
    >
      <div className="support-section-heading">
        <p>Your support requests</p>
        <h2 id="support-request-history-title">Request history</h2>
      </div>
      {loading ? <p>Loading your requests...</p> : null}
      {error ? (
        <p className="support-submit-error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && requests.length === 0 ? (
        <div className="support-request-empty">
          <strong>No support requests yet</strong>
          <p>
            Your submitted requests and administrator responses will appear
            here.
          </p>
        </div>
      ) : null}
      <div className="support-request-list">
        {requests.map((request) => (
          <article
            className="support-request-card"
            key={request.id}
            id={`support-request-${request.id}`}
          >
            <div className="support-request-card-heading">
              <div>
                <h3>{issueTypeLabels[request.issueType]}</h3>
                <small>Submitted {formatSupportDate(request.createdAt)}</small>
              </div>
              <span
                className={`support-status support-status--${request.status}`}
              >
                {statusLabels[request.status]}
              </span>
            </div>
            <div className="support-request-content">
              <strong>Your message</strong>
              <p>{request.message}</p>
            </div>
            <div className="support-request-content support-request-response">
              <strong>Administrator response</strong>
              {request.adminResponse ? (
                <>
                  <p>{request.adminResponse}</p>
                  {request.respondedAt ? (
                    <small>
                      Responded {formatSupportDate(request.respondedAt)}
                    </small>
                  ) : null}
                </>
              ) : (
                <p className="support-response-pending">
                  Awaiting administrator response
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TraineeSupport() {
  const [issueType, setIssueType] = useState<SupportIssueType | ''>('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{
    issueType?: string;
    message?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanMessage = message.trim();
    const nextErrors = {
      issueType: issueType ? undefined : 'Select an issue type.',
      message: !cleanMessage
        ? 'Enter a message.'
        : cleanMessage.length > 1000
          ? 'Message must be 1,000 characters or fewer.'
          : undefined,
    };
    setErrors(nextErrors);
    setFailure('');
    if (nextErrors.issueType || nextErrors.message) return;

    setSubmitting(true);
    try {
      await apiRequest<{ id: number }>('/trainee/support/messages', {
        method: 'POST',
        body: JSON.stringify({ issueType, message: cleanMessage }),
      });
      setSent(true);
    } catch (error) {
      setFailure(
        error instanceof ApiError
          ? error.message
          : 'Your message could not be sent. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (sent)
    return (
      <div className="trainee-support-page">
        <section className="support-success" role="status">
          <span aria-hidden="true">✓</span>
          <p className="eyebrow">Message sent</p>
          <h1>Your message has been sent to an administrator.</h1>
          <p>An administrator can now review your support request.</p>
          <div>
            <Link to="/trainee/help">Return to Help &amp; FAQ</Link>
            <Link to="/trainee/dashboard">Return to Dashboard</Link>
          </div>
        </section>
        <SupportRequestHistory />
      </div>
    );

  return (
    <div className="trainee-support-page">
      <header className="support-page-header">
        <p className="eyebrow">Help &amp; support</p>
        <h1>Contact Administrator</h1>
        <p>
          Describe the issue and a KISTS administrator can review your message.
        </p>
      </header>
      <form
        className="support-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <label htmlFor="support-issue-type">Issue type / subject</label>
        <select
          id="support-issue-type"
          value={issueType}
          onChange={(event) =>
            setIssueType(event.target.value as SupportIssueType | '')
          }
          aria-invalid={Boolean(errors.issueType)}
          aria-describedby={errors.issueType ? 'issue-type-error' : undefined}
        >
          <option value="">Select an issue type</option>
          {Object.entries(issueTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.issueType ? (
          <p id="issue-type-error" className="support-field-error">
            {errors.issueType}
          </p>
        ) : null}

        <label htmlFor="support-message">Message</label>
        <textarea
          id="support-message"
          value={message}
          maxLength={1000}
          rows={8}
          onChange={(event) => setMessage(event.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={
            errors.message ? 'message-error message-count' : 'message-count'
          }
        />
        <div className="support-message-meta">
          <span id="message-count">{message.length} / 1000 characters</span>
        </div>
        {errors.message ? (
          <p id="message-error" className="support-field-error">
            {errors.message}
          </p>
        ) : null}
        {failure ? (
          <p className="support-submit-error" role="alert">
            {failure}
          </p>
        ) : null}

        <div className="support-form-actions">
          <Link to="/trainee/help">Cancel</Link>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </form>
      <SupportRequestHistory />
    </div>
  );
}
