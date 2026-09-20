import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiRequest } from '../../services/api/request';
import { useAuth } from '../auth/auth.context';
import type { SystemRole } from '../auth/auth.types';
import '../trainee/trainee-settings.css';

const REDUCE_MOTION_KEY = 'kists:preferences:reduce-motion';

function PasswordDialog({ endpoint, onClose }: { endpoint: string; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const currentRef = useRef<HTMLInputElement>(null);
  useEffect(() => { currentRef.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [onClose]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(null);
    if (newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'New password and confirmation must match.' }); return; }
    setSaving(true);
    try { await apiRequest<void>(`${endpoint}/password`, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); setMessage({ type: 'success', text: 'Password updated successfully.' }); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
    catch (error) { setMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'Password could not be updated.' }); }
    finally { setSaving(false); }
  }
  return <div className="settings-dialog-backdrop"><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title"><header><div><p>Account security</p><h2 id="password-dialog-title">Change password</h2></div><button type="button" onClick={onClose} aria-label="Close password dialog">×</button></header><form onSubmit={submit}><label>Current password<input ref={currentRef} type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>New password<input type="password" required minLength={12} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>At least 12 characters and no more than 72 UTF-8 bytes.</small></label><label>Confirm new password<input type="password" required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{message ? <p className={`settings-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}<footer><button type="button" className="settings-button secondary" onClick={onClose}>Cancel</button><button className="settings-button primary" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button></footer></form></section></div>;
}

export function AccountSettings({ role }: { role: SystemRole }) {
  const { user, refresh } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem(REDUCE_MOTION_KEY) === 'true');
  const fileRef = useRef<HTMLInputElement>(null);
  const closePassword = useCallback(() => setPasswordOpen(false), []);
  const isAdmin = role === 'administrator';
  const endpoint = isAdmin ? '/admin/settings' : '/trainee/settings';
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '';
  useEffect(() => { if (isAdmin) return; document.documentElement.classList.toggle('kists-reduce-motion', reduceMotion); localStorage.setItem(REDUCE_MOTION_KEY, String(reduceMotion)); }, [isAdmin, reduceMotion]);

  async function uploadAvatar(file?: File) {
    if (!file) return;
    setAvatarMessage(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setAvatarMessage({ type: 'error', text: 'Choose a JPEG, PNG or WebP image.' }); return; }
    if (file.size > 2 * 1024 * 1024) { setAvatarMessage({ type: 'error', text: 'Profile photos must be 2 MB or smaller.' }); return; }
    setUploading(true);
    try { await apiRequest(`${endpoint}/avatar`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } }); await refresh(); setAvatarMessage({ type: 'success', text: 'Profile photo updated.' }); }
    catch (error) { setAvatarMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'Profile photo could not be uploaded.' }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function removeAvatar() {
    setUploading(true); setAvatarMessage(null);
    try { await apiRequest<void>(`${endpoint}/avatar`, { method: 'DELETE', body: '{}' }); await refresh(); setAvatarMessage({ type: 'success', text: 'Profile photo removed.' }); }
    catch (error) { setAvatarMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'Profile photo could not be removed.' }); }
    finally { setUploading(false); }
  }

  if (!user) return null;
  return <div className={`trainee-settings-page${isAdmin ? ' admin-settings-page' : ''}`}><header className="trainee-settings-header"><p>{isAdmin ? 'Management Workspace / Settings' : 'My Account / Settings'}</p><h1>Settings</h1><span>{isAdmin ? 'Manage your profile and account security.' : 'Manage your profile, account security and training experience.'}</span></header>
    <section className="settings-profile-card" aria-labelledby="profile-title"><div className="settings-section-heading"><p>Profile &amp; account</p><h2 id="profile-title">Your {isAdmin ? 'administrator' : 'trainee'} profile</h2></div><div className="settings-profile-summary"><div className="settings-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt={`${fullName} profile`} /> : <span>{initials}</span>}</div><div className="settings-profile-name"><h3>{fullName}</h3><p>{isAdmin ? 'KISTS Administrator' : user.jobRole ?? 'No workplace role assigned'}</p><div><label className="settings-button primary">{uploading ? 'Uploading…' : user.avatarUrl ? 'Change photo' : 'Upload photo'}<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => void uploadAvatar(event.target.files?.[0])} /></label>{user.avatarUrl ? <button className="settings-button secondary" disabled={uploading} onClick={() => void removeAvatar()}>Remove photo</button> : null}</div><small>JPEG, PNG or WebP · Maximum 2 MB</small></div></div>{avatarMessage ? <p className={`settings-message ${avatarMessage.type}`} role={avatarMessage.type === 'error' ? 'alert' : 'status'}>{avatarMessage.text}</p> : null}<dl className="settings-account-grid"><div><dt>Full name</dt><dd>{fullName}</dd><small>{isAdmin ? 'Managed account identity' : 'Managed by administrator'}</small></div><div><dt>Email</dt><dd>{user.email}</dd><small>{isAdmin ? 'Managed account identity' : 'Managed by administrator'}</small></div><div><dt>{isAdmin ? 'System role' : 'Job role'}</dt><dd>{isAdmin ? 'Administrator' : user.jobRole ?? 'Not assigned'}</dd><small>{isAdmin ? 'KISTS management access' : 'Managed by administrator'}</small></div><div><dt>Status</dt><dd><span className="settings-active-dot" />Active</dd><small>Your account is available</small></div></dl></section>
    <div className="settings-secondary-grid"><section className="settings-card" aria-labelledby="security-title"><div className="settings-section-heading"><p>Account security</p><h2 id="security-title">Password</h2></div><p>Keep your KISTS account secure with a strong password.</p><button className="settings-button secondary" onClick={() => setPasswordOpen(true)}>Change password</button></section>{!isAdmin ? <section className="settings-card" aria-labelledby="accessibility-title"><div className="settings-section-heading"><p>Accessibility &amp; experience</p><h2 id="accessibility-title">Motion preferences</h2></div><label className="settings-toggle"><span><strong>Reduce motion</strong><small>Reduce confetti, transitions and other non-essential animations.</small></span><input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} aria-label="Reduce motion" /><i aria-hidden="true" /></label></section> : null}</div>
    {passwordOpen ? <PasswordDialog endpoint={endpoint} onClose={closePassword} /> : null}
  </div>;
}
