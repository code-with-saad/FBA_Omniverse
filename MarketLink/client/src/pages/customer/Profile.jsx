import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import { ConfirmModal } from '../../components/common/Modal';
import Avatar from '../../components/common/Avatar';
import ProfilePhoto from '../../components/common/ProfilePhoto';
import PasswordInput from '../../components/common/PasswordInput';
import { t } from '../../i18n';
import PhoneInput from '../../components/common/PhoneInput';
import SaveBar, { isChanged } from '../../components/common/SaveBar';

export function PasswordForm() {
  const { toast } = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return toast(t('New passwords do not match'), 'warning');
    setBusy(true);
    try {
      const res = await api.put('/auth/password', form);
      toast(res.message);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-head">
        <h5>
          <i className="bi bi-shield-lock" /> {t('Change password')}
        </h5>
      </div>
      <div className="d-grid gap-3">
        <div>
          <label className="form-label" htmlFor="pw-current">{t('Current password')}</label>
          <PasswordInput id="pw-current" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} autoComplete="current-password" />
        </div>
        <div>
          <label className="form-label" htmlFor="pw-new">{t('New password')}</label>
          <PasswordInput id="pw-new" required value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} autoComplete="new-password" />
          <div className="fs-7 text-muted-2 mt-1">{t('At least 8 characters with letters and numbers.')}</div>
        </div>
        <div>
          <label className="form-label" htmlFor="pw-confirm">{t('Confirm new password')}</label>
          <PasswordInput id="pw-confirm" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" />
        </div>
      </div>
      <button type="submit" className="btn btn-primary mt-3" disabled={busy}>
        {t('Update password')}
      </button>
    </form>
  );
}

function FamilyPanel() {
  const { toast } = useToast();
  const { refresh } = useAuth();
  const { data, reload, setData } = useFetch('/customer/family');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      setData(await api.post('/customer/family', { email }));
      setEmail('');
      toast(t('Family member added'));
      refresh();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      setData(await api.del(`/customer/family/${removing._id}`));
      toast(removing.isMe ? t('You left the household') : t('Member removed'));
      setRemoving(null);
      refresh();
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const members = data?.members || [];
  const canAdd = !data?.household || data.isOwner;

  return (
    <section className="panel family-panel">
      <div className="family-banner">
        <span className="family-banner-icon" aria-hidden="true">
          <i className="bi bi-people-fill" />
        </span>
        <div className="family-banner-text">
          <h5>
            {t('Family sharing')} <span className="chip chip-soft">{t('optional')}</span>
          </h5>
          <p>{t('Link family members’ accounts so everyone in the household can see each other’s pre-orders and pickups.')}</p>
        </div>
        <span className="family-banner-count">
          <strong>{members.length}</strong> {members.length === 1 ? t('member') : t('members')}
        </span>
      </div>

      {members.length > 0 ? (
        <div className="row g-2 mb-3">
          {members.map((m) => (
            <div key={m._id} className="col-md-6">
              <div className="family-member">
                <Avatar name={m.name} src={m.avatar} className="avatar-sm" />
                <span className="family-member-text">
                  <strong>
                    {m.name} {m.isMe && <span className="text-muted-2 fw-normal">{t('(you)')}</span>}
                  </strong>
                  <span>{m.email}</span>
                </span>
                {m.isOwner && <span className="chip chip-lime">{t('Owner')}</span>}
                {(data.isOwner || m.isMe) && (
                  <button type="button" className="btn btn-sm btn-white" onClick={() => setRemoving(m)}>
                    {m.isMe ? t('Leave') : t('Remove')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="small text-muted-2 mb-3">
          <i className="bi bi-info-circle me-1" aria-hidden="true" />
          {t('No household yet. Add a family member who already has a MarketLink account to start one; you become the owner.')}
        </p>
      )}

      {canAdd && (
        <form className="family-add" onSubmit={add}>
          <label className="form-label" htmlFor="fam-email">
            {t('Add a family member')}
          </label>
          <div className="family-add-row">
            <input id="fam-email" type="email" className="form-control" placeholder={t('Their e-mail (they need a MarketLink account)')} value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-person-plus" aria-hidden="true" />} {t('Add member')}
            </button>
          </div>
        </form>
      )}
      <ConfirmModal
        open={Boolean(removing)}
        title={removing?.isMe ? t('Leave household?') : t('Remove {name}?', { name: removing?.name })}
        message={removing?.isMe && data?.isOwner ? t('You are the owner, so the whole household will be dissolved.') : t('You will no longer see each other’s orders.')}
        confirmLabel={removing?.isMe ? t('Leave') : t('Remove')}
        danger
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
}

export default function Profile() {
  useDocumentTitle(t('Profile'));
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [saved, setSaved] = useState(() => ({ name: user.name, phone: user.phone || '', address: user.address || '', city: user.city || '' }));
  const [form, setForm] = useState(saved);
  const [busy, setBusy] = useState(false);
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const dirty = isChanged(form, saved);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile(form);
      setSaved(form);
      toast(t('Profile saved'));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DashHeader title={t('Profile & family')} subtitle={t('Manage your photo, personal details, password and household sharing.')} />
      <div className="row g-4 mb-4">
        <div className="col-xl-7">
          <form id="profile-form" className="panel" onSubmit={save}>
            <div className="panel-head">
              <h5>
                <i className="bi bi-person" /> {t('Personal details')}
              </h5>
            </div>
            <ProfilePhoto />
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="p-name">{t('Full name')}</label>
                <input id="p-name" name="name" className="form-control" required value={form.name} onChange={change} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="p-email">{t('E-mail')}</label>
                <input id="p-email" className="form-control" value={user.email} disabled />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="p-phone">{t('Contact number')}</label>
                <PhoneInput id="p-phone" required value={form.phone} onChange={change} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="p-city">{t('City')}</label>
                <input id="p-city" name="city" className="form-control" value={form.city} onChange={change} />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="p-address">{t('Address')}</label>
                <input id="p-address" name="address" className="form-control" required value={form.address} onChange={change} />
              </div>
            </div>
            <SaveBar dirty={dirty} busy={busy} form="profile-form" onCancel={() => setForm(saved)} />
          </form>
        </div>
        <div className="col-xl-5">
          <PasswordForm />
        </div>
      </div>
      <FamilyPanel />
    </>
  );
}
