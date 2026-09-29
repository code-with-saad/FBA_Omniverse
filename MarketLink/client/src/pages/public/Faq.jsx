import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useSeo from '../../hooks/useSeo';
import { PageHero } from '../../components/common/PageHeader';
import { Bone } from '../../components/common/Skeletons';
import FaqList from '../../components/faq/FaqList';
import { breadcrumbLd, faqLd, ldGraph } from '../../utils/seo';
import { t } from '../../i18n';

const GROUP_ICONS = { shopping: 'bi-basket2', pickup: 'bi-geo-alt', farmers: 'bi-shop', account: 'bi-person-lock' };

const matches = (f, q) => !q || `${f.question} ${f.answer} ${f.questionUr || ''} ${f.answerUr || ''}`.toLowerCase().includes(q);

export default function Faq() {
  const { data, loading, error } = useFetch('/faqs');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const faqs = useMemo(() => data?.faqs || [], [data]);
  const groups = data?.groups || {};
  const q = query.trim().toLowerCase();
  const shown = faqs.filter((f) => (group === 'all' || f.group === group) && matches(f, q));
  const sections = Object.keys(groups)
    .map((key) => ({ key, label: groups[key], items: shown.filter((f) => f.group === key) }))
    .filter((s) => s.items.length);
  const [openFaq, setOpenFaq] = useState(undefined);
  const linked = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  const firstId = sections[0] && !q ? `faq-${sections[0].items[0]._id}` : null;
  const currentOpen = openFaq === undefined ? (faqs.some((f) => `faq-${f._id}` === linked) ? linked : firstId) : openFaq;

  useSeo({
    title: t('Frequently asked questions'),
    description: t('Answers about pre-ordering from local farmers on MarketLink: how ordering works, pickup at the market, paying the farmer in cash, changing an order and selling as a farmer.'),
    keywords: [t('MarketLink FAQ'), t('how to pre-order vegetables'), t('farmers market pickup'), t('pay at pickup'), t('sell produce online Pakistan')],
    jsonLd: ldGraph(faqLd(faqs), breadcrumbLd([{ name: t('FAQs'), path: '/faq' }])),
  });

  return (
    <>
      <PageHero
        crumbs={[{ label: 'FAQs' }]}
        title={t('Frequently asked questions')}
        subtitle={t('Short answers about ordering, pickup, payment and selling on MarketLink. In one line: you reserve fresh food from local farmers online, collect it at the market and pay the farmer there.')}
      >
        <div className="faq-search">
          <i className="bi bi-search" aria-hidden="true" />
          <label htmlFor="faq-search" className="visually-hidden">
            {t('Search the questions')}
          </label>
          <input id="faq-search" type="search" className="form-control" placeholder={t('Search, e.g. payment, cancel, pickup')} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} />
          {query && (
            <button type="button" className="faq-search-clear" onClick={() => setQuery('')} aria-label={t('Clear search')}>
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          )}
        </div>
      </PageHero>

      <div className="container pb-5">
        <div className="faq-tabs" role="group" aria-label={t('Topics')}>
          <button type="button" className={`chip chip-btn ${group === 'all' ? 'active' : ''}`} aria-pressed={group === 'all'} onClick={() => setGroup('all')}>
            {t('All questions')}
          </button>
          {Object.entries(groups).map(([key, label]) => (
            <button key={key} type="button" className={`chip chip-btn ${group === key ? 'active' : ''}`} aria-pressed={group === key} onClick={() => setGroup(key)}>
              <i className={`bi ${GROUP_ICONS[key] || 'bi-question-circle'}`} aria-hidden="true" /> {t(label)}
            </button>
          ))}
        </div>

        <div className="row g-4">
          <div className="col-lg-8">
            {error && <div className="alert alert-danger">{error.message}</div>}
            {loading && !data && (
              <div className="d-grid gap-2" aria-busy="true" aria-label={t('Loading the questions')}>
                {Array.from({ length: 6 }, (_, i) => (
                  <Bone key={i} h={58} r={16} />
                ))}
              </div>
            )}
            {data && sections.length === 0 && (
              <div className="soft-panel text-center py-4">
                <i className="bi bi-search fs-3 text-muted-2" aria-hidden="true" />
                <p className="mb-2 mt-2">{t('No question matches “{q}”.', { q: query })}</p>
                <button type="button" className="btn btn-white btn-sm" onClick={() => { setQuery(''); setGroup('all'); }}>
                  {t('Show all questions')}
                </button>
              </div>
            )}
            {sections.map((s) => (
              <section key={s.key} className="faq-section" aria-labelledby={`faq-group-${s.key}`}>
                <h2 id={`faq-group-${s.key}`} className="faq-group-title">
                  <i className={`bi ${GROUP_ICONS[s.key] || 'bi-question-circle'}`} aria-hidden="true" /> {t(s.label)}
                </h2>
                <FaqList faqs={s.items} openId={currentOpen} onToggle={setOpenFaq} />
              </section>
            ))}
          </div>
          <aside className="col-lg-4">
            <div className="faq-help">
              <span className="faq-help-icon" aria-hidden="true">
                <i className="bi bi-chat-dots" />
              </span>
              <h2 className="h5 mt-3">{t('Still have a question?')}</h2>
              <p className="small text-muted-2">{t('Ask the MarketLink assistant (the chat button at the bottom of the page) or send us a message. We reply within one working day.')}</p>
              <Link to="/contact" className="btn btn-primary w-100">
                <i className="bi bi-envelope" /> {t('Contact us')}
              </Link>
              <hr />
              <h3 className="h6">{t('Popular pages')}</h3>
              <ul className="faq-links">
                <li>
                  <Link to="/products">{t('Shop this week’s produce')}</Link>
                </li>
                <li>
                  <Link to="/markets">{t('Markets and opening times')}</Link>
                </li>
                <li>
                  <Link to="/register/farmer">{t('Sell as a farmer')}</Link>
                </li>
                <li>
                  <Link to="/terms">{t('Terms & Conditions')}</Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
