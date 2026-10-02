import { useEffect, useMemo, useState } from 'react';
import { apiRequest, ApiError } from '../../services/api/request';
import {
  formatSupportDate,
  issueTypeLabels,
  statusLabels,
  type SupportMessage,
  type SupportStatus,
} from './support.types';
import './support.css';

type Filter = 'all' | SupportStatus;

export function AdminSupportMessages() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SupportMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [responseDraft, setResponseDraft] = useState('');
  const [responseError, setResponseError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<{ messages: SupportMessage[] }>(
        '/admin/support/messages',
      );
      setMessages(data.messages);
    } catch (requestError) {
      if (!(requestError instanceof ApiError && requestError.status === 401))
        setError('Support messages could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visibleMessages = useMemo(
    () =>
      messages.filter((message) => {
        const query = search.trim().toLowerCase();
        return (
          (filter === 'all' || message.status === filter) &&
          (!query ||
            `${message.traineeFirstName} ${message.traineeLastName} ${message.traineeEmail} ${message.message}`
              .toLowerCase()
              .includes(query))
        );
      }),
    [filter, messages, search],
  );

  function openMessage(message: SupportMessage) {
    setSelected(message);
    setResponseDraft(message.adminResponse ?? '');
    setResponseError('');
    void apiRequest<void>(`/admin/support/notifications/${message.id}/read`, {
      method: 'POST',
      body: '{}',
    })
      .then(() => {
        window.dispatchEvent(new Event('kists:support-notifications-changed'));
      })
      .catch(() => {
        setError('This request could not be marked as read.');
      });
  }

  function closeMessage() {
    setSelected(null);
    setResponseDraft('');
    setResponseError('');
  }

  async function saveResponse() {
    if (!selected || saving) return;
    const adminResponse = responseDraft.trim();
    if (!adminResponse || adminResponse.length > 4000) {
      setResponseError('Enter a response of 4,000 characters or fewer.');
      return;
    }
    setSaving(true);
    setResponseError('');
    try {
      const response = await apiRequest<{
        adminResponse: string;
        respondedAt: string;
        respondedBy: number;
      }>(`/admin/support/messages/${selected.id}/response`, {
        method: 'PATCH',
        body: JSON.stringify({ adminResponse }),
      });
      const updated = { ...selected, ...response };
      setMessages((current) =>
        current.map((message) =>
          message.id === selected.id ? updated : message,
        ),
      );
      closeMessage();
    } catch (requestError) {
      setResponseError(
        requestError instanceof ApiError
          ? requestError.message
          : 'The response could not be saved. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: SupportStatus) {
    if (!selected || saving || selected.status === status) return;
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/admin/support/messages/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const updated = { ...selected, status };
      setMessages((current) =>
        current.map((message) =>
          message.id === selected.id ? updated : message,
        ),
      );
      setSelected(updated);
    } catch {
      setError('The message status could not be updated. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="admin-support-page">
        <section className="support-page-state" role="status">
          <h1>Loading support messages</h1>
          <p>Preparing trainee requests…</p>
        </section>
      </div>
    );

  return (
    <div className="admin-support-page">
      <header className="admin-support-header">
        <div>
          <p className="eyebrow">Trainee support</p>
          <h1>Support Messages</h1>
          <p>Review trainee requests and keep their status current.</p>
        </div>
        <dl>
          <div>
            <dt>Open</dt>
            <dd>
              {messages.filter((message) => message.status === 'open').length}
            </dd>
          </div>
          <div>
            <dt>In Progress</dt>
            <dd>
              {
                messages.filter((message) => message.status === 'in_progress')
                  .length
              }
            </dd>
          </div>
          <div>
            <dt>Closed</dt>
            <dd>
              {messages.filter((message) => message.status === 'closed').length}
            </dd>
          </div>
        </dl>
      </header>

      {error ? (
        <p className="support-submit-error" role="alert">
          {error}
        </p>
      ) : null}
      <div
        className="support-filter-tabs"
        role="group"
        aria-label="Filter support messages"
      >
        {(
          [
            ['all', 'All'],
            ['open', 'Open'],
            ['in_progress', 'In Progress'],
            ['closed', 'Closed'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="admin-support-search">
        <span className="sr-only">Search trainee, email or message</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search trainee, email or message"
        />
      </label>

      <section
        className="admin-support-panel"
        aria-label="Support message list"
      >
        <div className="admin-support-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Issue type</th>
                <th>Message</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleMessages.map((message) => (
                <tr key={message.id}>
                  <td>
                    <strong>
                      {message.traineeFirstName} {message.traineeLastName}
                    </strong>
                    <small>{message.traineeEmail}</small>
                  </td>
                  <td>{issueTypeLabels[message.issueType]}</td>
                  <td>
                    <span className="support-message-preview">
                      {message.message}
                    </span>
                  </td>
                  <td>{formatSupportDate(message.createdAt)}</td>
                  <td>
                    <span
                      className={`support-status support-status--${message.status}`}
                    >
                      {statusLabels[message.status]}
                    </span>
                  </td>
                  <td>
                    <button type="button" onClick={() => openMessage(message)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleMessages.length === 0 ? (
          <div className="admin-support-empty">
            <strong>
              {messages.length === 0
                ? 'No support requests yet'
                : 'No matching requests'}
            </strong>
            <p>
              {messages.length === 0
                ? 'Trainee requests will appear here when submitted.'
                : 'Try another status or search term.'}
            </p>
          </div>
        ) : null}
      </section>

      {selected ? (
        <div
          className="support-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (!saving && event.target === event.currentTarget) closeMessage();
          }}
        >
          <section
            className="support-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-dialog-title"
          >
            <button
              className="support-dialog-close"
              type="button"
              aria-label="Close support message"
              disabled={saving}
              onClick={closeMessage}
            >
              ×
            </button>
            <p className="eyebrow">{issueTypeLabels[selected.issueType]}</p>
            <h2 id="support-dialog-title">
              Message from {selected.traineeFirstName}{' '}
              {selected.traineeLastName}
            </h2>
            <p className="support-dialog-email">
              {selected.traineeEmail} · {formatSupportDate(selected.createdAt)}
            </p>
            <div className="support-dialog-message">{selected.message}</div>
            <label htmlFor="support-admin-response">
              Administrator response
            </label>
            <textarea
              id="support-admin-response"
              value={responseDraft}
              maxLength={4000}
              rows={5}
              disabled={saving}
              placeholder="Write a response to the trainee..."
              onChange={(event) => setResponseDraft(event.target.value)}
            />
            {selected.respondedAt ? (
              <p className="support-response-date">
                Last responded {formatSupportDate(selected.respondedAt)}
              </p>
            ) : null}
            {responseError ? (
              <p className="support-submit-error" role="alert">
                {responseError}
              </p>
            ) : null}
            <button
              type="button"
              className="support-response-save"
              disabled={saving || !responseDraft.trim()}
              onClick={() => void saveResponse()}
            >
              {saving ? 'Saving...' : 'Save response'}
            </button>
            <label htmlFor="support-status">Status</label>
            <select
              id="support-status"
              value={selected.status}
              disabled={saving}
              onChange={(event) =>
                void updateStatus(event.target.value as SupportStatus)
              }
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </section>
        </div>
      ) : null}
    </div>
  );
}
