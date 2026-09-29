import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Avatar from './Avatar';
import { t } from '../../i18n';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 2;

/** Upload, change or remove the signed-in user's profile photo. */
export default function ProfilePhoto({ subtitle }) {
  const { user, uploadAvatar, removeAvatar } = useAuth();
  const { toast } = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState('');

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) return toast(t('Please choose a JPG, PNG or WEBP image'), 'warning');
    if (file.size > MAX_MB * 1024 * 1024) return toast(t('The photo must be smaller than {MAX_MB} MB', { MAX_MB }), 'warning');
    setBusy('upload');
    try {
      await uploadAvatar(file);
      toast(t('Profile photo updated'));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
    return undefined;
  }

  async function remove() {
    setBusy('remove');
    try {
      await removeAvatar();
      toast(t('Profile photo removed'));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="profile-photo">
      <button type="button" className="profile-photo-pic" onClick={() => input.current?.click()} disabled={Boolean(busy)} aria-label={t('Change profile photo')}>
        <Avatar name={user.name} src={user.avatar} className="avatar-xl" />
        <span className="profile-photo-cam" aria-hidden="true">
          {busy === 'upload' ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-camera" />}
        </span>
      </button>
      <div className="profile-photo-text">
        <strong className="d-block text-truncate">{user.name}</strong>
        <span className="small text-muted-2 d-block text-truncate">{subtitle || user.email}</span>
        <div className="d-flex gap-2 flex-wrap mt-2">
          <button type="button" className="btn btn-sm btn-soft" onClick={() => input.current?.click()} disabled={Boolean(busy)}>
            <i className="bi bi-upload" aria-hidden="true" /> {user.avatar ? t('Change photo') : t('Upload photo')}
          </button>
          {user.avatar && (
            <button type="button" className="btn btn-sm btn-white" onClick={remove} disabled={Boolean(busy)}>
              {busy === 'remove' ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-trash3" aria-hidden="true" />} {t('Remove')}
            </button>
          )}
        </div>
        <span className="fs-7 text-muted-2 d-block mt-1">{t('JPG, PNG or WEBP, up to {n} MB.', { n: MAX_MB })}</span>
      </div>
      <input ref={input} type="file" accept={TYPES.join(',')} className="d-none" onChange={pick} aria-label={t('Profile photo file')} />
    </div>
  );
}
