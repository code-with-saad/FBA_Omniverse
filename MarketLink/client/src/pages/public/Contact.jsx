import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CONTACT_TOPICS } from '../../utils/contactTopics';
import { PageHero } from '../../components/common/PageHeader';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { CONTACT } from '../../config';
import SocialLinks from '../../components/common/SocialLinks';
import useSeo from '../../hooks/useSeo';
import { breadcrumbLd } from '../../utils/seo';
import { t } from '../../i18n';

export default function Contact() {
  useSeo({ title: t('Contact us'), description: t('Questions about an order, joining as a farmer or partnering with a market? Contact the MarketLink team.'), jsonLd: breadcrumbLd([{ name: 'Contact us', path: '/contact' }]) });
  const { user } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const startTopic = CONTACT_TOPICS.some((x) => x.value === params.get('topic')) ? params.get('topic') : '';
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', subject: '', topic: startTopic, message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/contact', form);
      toast(res.message);
      setSent(true);
      setForm({ ...form, subject: '', topic: '', message: '' });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHero crumbs={[{ label: t('Contact') }]} title={t('Get in touch')} subtitle={t('Questions about an order, joining as a farmer or partnering with a market? We\'d love to hear from you.')} />
      <div className="container pb-5">
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="cta-band mb-4">
              <h2 className="h3">{t('MarketLink team')}</h2>
              <ul className="list-unstyled d-grid gap-3 mt-3 mb-0">
                <li className="d-flex gap-3">
                  <i className="bi bi-geo-alt-fill text-lime fs-5" />
                  <span>{t(CONTACT.address)}</span>
                </li>
                <li className="d-flex gap-3">
                  <i className="bi bi-envelope-fill text-lime fs-5" />
                  <a className="text-white" href={`mailto:${CONTACT.email}`}>
                    {CONTACT.email}
                  </a>
                </li>
                <li className="d-flex gap-3">
                  <i className="bi bi-telephone-fill text-lime fs-5" />
                  <span><bdi dir="ltr">{CONTACT.phone}</bdi></span>
                </li>
                <li className="d-flex gap-3">
                  <i className="bi bi-clock-fill text-lime fs-5" />
                  <span>{t(CONTACT.hours)}</span>
                </li>
              </ul>
              <div className="mt-3 pt-3 border-top border-light border-opacity-25">
                <span className="small fw-semi d-block mb-2">{t('Follow MarketLink')}</span>
                <SocialLinks />
              </div>
            </div>
            <div className="map-frame" style={{ height: 300 }}>
              <iframe
                title={t('MarketLink office on Google Maps')}
                src={`https://www.google.com/maps?q=${encodeURIComponent(CONTACT.mapQuery)}&z=15&output=embed`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a className="small d-inline-block mt-2" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.mapQuery)}`} target="_blank" rel="noreferrer">
              <i className="bi bi-box-arrow-up-right" /> {t('Open in Google Maps')}
            </a>
          </div>
          <div className="col-lg-7">
            <form className="soft-panel" onSubmit={submit}>
              <h2 className="h4 mb-3">{t('Send us a message')}</h2>
              {sent && (
                <div className="alert alert-success small">
                  <i className="bi bi-check-circle" /> {t('Message sent. We usually reply within one working day.')}
                </div>
              )}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="c-name">{t('Your name')}</label>
                  <input id="c-name" name="name" className="form-control" required value={form.name} onChange={change} />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="c-email">{t('E-mail')}</label>
                  <input id="c-email" name="email" type="email" className="form-control" required value={form.email} onChange={change} />
                </div>
                <div className="col-md-5">
                  <label className="form-label" htmlFor="c-topic">
                    {t('Topic')} <span className="text-muted-2 fw-normal">{t('(optional)')}</span>
                  </label>
                  <select id="c-topic" name="topic" className="form-select" value={form.topic} onChange={change}>
                    <option value="">{t('Choose a topic')}</option>
                    {CONTACT_TOPICS.map((x) => (
                      <option key={x.value} value={x.value}>
                        {t(x.label)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-7">
                  <label className="form-label" htmlFor="c-subject">{t('Subject')}</label>
                  <input id="c-subject" name="subject" className="form-control" value={form.subject} onChange={change} maxLength={150} />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="c-message">{t('Message')}</label>
                  <textarea id="c-message" name="message" className="form-control" rows={6} required value={form.message} onChange={change} maxLength={2000} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary mt-3" disabled={busy}>
                {busy ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-send" />} {t('Send message')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
