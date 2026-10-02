import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api/request';
import { DashboardIcon } from '../trainee/DashboardIcon';
import {
  formatSupportDate,
  issueTypeLabels,
  type SupportIssueType,
} from './support.types';
import './support-notifications.css';

type Notification = {
  id: number;
  issueType: SupportIssueType;
  createdAt: string;
  traineeFirstName?: string;
  traineeLastName?: string;
};

export function SupportNotifications({ role }: { role: 'trainee' | 'admin' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const endpoint = `/${role}/support/notifications`;
  const panelId = `support-notifications-${role}`;

  const refresh = useCallback(async () => {
    try {
      const result = await apiRequest<{
        unreadCount: number;
        notifications: Notification[];
      }>(endpoint);
      setNotifications(result.notifications);
      setError('');
    } catch {
      setError('Notifications could not be loaded.');
    }
  }, [endpoint]);

  useEffect(() => {
    let current = true;
    void apiRequest<{
      unreadCount: number;
      notifications: Notification[];
    }>(endpoint)
      .then((result) => {
        if (!current) return;
        setNotifications(result.notifications);
        setError('');
      })
      .catch(() => {
        if (current) setError('Notifications could not be loaded.');
      });
    return () => {
      current = false;
    };
  }, [location.pathname, endpoint]);

  useEffect(() => {
    const changed = () => void refresh();
    window.addEventListener('kists:support-notifications-changed', changed);
    return () =>
      window.removeEventListener(
        'kists:support-notifications-changed',
        changed,
      );
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  async function openNotification(notification: Notification) {
    try {
      await apiRequest<void>(`${endpoint}/${notification.id}/read`, {
        method: 'POST',
        body: JSON.stringify(
          role === 'trainee' ? { respondedAt: notification.createdAt } : {},
        ),
      });
      setNotifications((current) =>
        current.filter((item) => item.id !== notification.id),
      );
      setOpen(false);
      navigate(
        role === 'admin'
          ? '/admin/support'
          : `/trainee/support#support-request-${notification.id}`,
      );
    } catch {
      await refresh();
      setError('This notification could not be opened. Please try again.');
    }
  }

  return (
    <div
      className={`support-notifications support-notifications--${role}`}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        className={
          role === 'trainee'
            ? 'notification-bell'
            : 'support-notifications-bell'
        }
        type="button"
        aria-label={`Notifications, ${notifications.length} unread`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
          void refresh();
        }}
      >
        <DashboardIcon name="bell" />
        {notifications.length > 0 ? (
          <span className="support-notifications-count" aria-hidden="true">
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          className="support-notifications-panel"
          id={panelId}
          aria-label="Support notifications"
        >
          <h2>Notifications</h2>
          {error ? (
            <p className="support-notifications-error" role="alert">
              {error}
            </p>
          ) : null}
          {notifications.length === 0 ? (
            <p className="support-notifications-empty">No new notifications</p>
          ) : (
            <div className="support-notifications-list">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                >
                  <strong>
                    {role === 'admin'
                      ? 'New support request'
                      : 'Support request updated'}
                  </strong>
                  <span>
                    {role === 'admin'
                      ? `${notification.traineeFirstName} ${notification.traineeLastName} · ${issueTypeLabels[notification.issueType]}`
                      : `Administrator responded to your ${issueTypeLabels[notification.issueType]} request.`}
                  </span>
                  <small>{formatSupportDate(notification.createdAt)}</small>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
