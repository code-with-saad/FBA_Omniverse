import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import { resetFilterOptions, useFilterOptions } from './FilterBar';
import SearchSelect from '../common/SearchSelect';
import PhoneInput from '../common/PhoneInput';

const EMPTY = {
  farmer: { stallName: '', contactPerson: '', phone: '', email: '', address: '', city: '', bio: '', categories: [], markets: [], status: 'active', password: '' },
  customer: { name: '', phone: '', email: '', address: '', city: '', password: '' },
};

/** Admin creates a farmer (stall) or customer account. Without a password an invite e-mail is sent. */
export default function AdminAccountModal({ type = 'farmer', onClose, onCreated }) {
  const { toast } = useToast();
  const options = useFilterOptions();
  const [form, setForm] = useState(EMPTY[type]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(false);
  const [variant, setVariant] = useState(0);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const toggle = (key, id) => setForm({ ...form, [key]: form[key].includes(id) ? form[key].filter((x) => x !== id) : [...form[key], id] });
  const isFarmer = type === 'farmer';

  // "Generate with AI": an "about the farm" text from the stall name, city, categories and markets
  async function writeBio() {
    if (form.stallName.trim().length < 2) return toast('Type the stall / farm name first', 'warning');
    setWriting(true);
    try {
      const res = await api.post('/admin/farmers/describe', { stallName: form.stallName, contactPerson: form.contactPerson, city: form.city, categories: form.categories, markets: form.markets, variant });
      setForm((f) => ({ ...f, bio: res.description }));
      setVariant((v) => v + 1);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setWriting(false);
    }
    return undefined;
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { ...form };
      if (!body.password) delete body.password;
      const res = await api.post(isFarmer ? '/admin/farmers' : '/admin/customers', body);
      resetFilterOptions();
      toast(`${isFarmer ? form.stallName : form.name} created${res.inviteSent ? ', invite e-mail sent' : ''}`);
      onCreated?.(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isFarmer ? 'Add a farmer / stall' : 'Add a customer'}
      size="modal-lg"
      footer={
        <>
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="account-form" className="btn btn-primary" disabled={busy}>
            {busy ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-person-check" />} Create account
          </button>
        </>
      }
    >
      <form id="account-form" onSubmit={submit}>
        {error && <div className="alert alert-danger small py-2">{error}</div>}
        <div className="row g-3">
          {isFarmer ? (
            <>
              <div className="col-md-6">
                <label className="form-label" htmlFor="a-stall">Stall / business name</label>
                <input id="a-stall" name="stallName" className="form-control" required value={form.stallName} onChange={change} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="a-contact">Contact person</label>
                <input id="a-contact" name="contactPerson" className="form-control" required value={form.contactPerson} onChange={change} />
              </div>
            </>
          ) : (
            <div className="col-12">
              <label className="form-label" htmlFor="a-name">Full name</label>
              <input id="a-name" name="name" className="form-control" required value={form.name} onChange={change} />
            </div>
          )}
          <div className="col-md-6">
            <label className="form-label" htmlFor="a-email">E-mail (login)</label>
            <input id="a-email" name="email" type="email" className="form-control" required value={form.email} onChange={change} />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="a-phone">Contact number</label>
            <PhoneInput id="a-phone" required value={form.phone} onChange={change} />
          </div>
          <div className="col-md-8">
            <label className="form-label" htmlFor="a-address">Address</label>
            <input id="a-address" name="address" className="form-control" required value={form.address} onChange={change} />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="a-city">City</label>
            <SearchSelect
              id="a-city"
              value={form.city}
              onChange={(v) => setForm((f) => ({ ...f, city: v }))}
              required={isFarmer}
              ariaLabel="City"
              placeholder="Choose a city"
              options={options.cities.filter((c) => c.isActive !== false).map((c) => ({ value: c.name, label: c.name, hint: c.province }))}
            />
          </div>
          {isFarmer && (
            <>
              <div className="col-12">
                <span className="form-label d-block">What they grow / sell</span>
                <div className="pick-chips">
                  {options.categories.map((c) => (
                    <button type="button" key={c._id} className={`filter-chip ${form.categories.includes(c._id) ? 'active' : ''}`} aria-pressed={form.categories.includes(c._id)} onClick={() => toggle('categories', c._id)}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-12">
                <span className="form-label d-block">Markets</span>
                <div className="pick-chips">
                  {options.markets.map((m) => (
                    <button type="button" key={m._id} className={`filter-chip ${form.markets.includes(m._id) ? 'active' : ''}`} aria-pressed={form.markets.includes(m._id)} onClick={() => toggle('markets', m._id)}>
                      <i className="bi bi-geo-alt" /> {m.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-12">
                <div className="d-flex align-items-end justify-content-between gap-2 mb-1">
                  <label className="form-label mb-0" htmlFor="a-bio">About the farm (optional)</label>
                  <button type="button" className="btn btn-sm btn-ai" onClick={writeBio} disabled={writing}>
                    {writing ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-stars" />} {variant ? 'Try another' : 'Generate with AI'}
                  </button>
                </div>
                <textarea id="a-bio" name="bio" rows={4} className="form-control" value={form.bio} onChange={change} maxLength={1200} placeholder="Fill in the stall name, city, categories and markets, then press Generate with AI" />
              </div>
              <div className="col-md-6">
                <span className="form-label d-block">Account status</span>
                <div className="tabs-pill">
                  {[
                    ['active', 'Approved now'],
                    ['pending', 'Needs review'],
                  ].map(([v, l]) => (
                    <button key={v} type="button" className={form.status === v ? 'active' : ''} onClick={() => setForm({ ...form, status: v })}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className={isFarmer ? 'col-md-6' : 'col-12'}>
            <label className="form-label" htmlFor="a-pass">Password (optional)</label>
            <input id="a-pass" name="password" type="text" className="form-control" autoComplete="new-password" placeholder="Leave empty to e-mail an invite link" value={form.password} onChange={change} />
            <div className="fs-7 text-muted-2 mt-1">
              {form.password ? 'At least 8 characters with letters and numbers. Share it with the person.' : 'They get an e-mail with a link (valid 3 days) to choose their own password.'}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
