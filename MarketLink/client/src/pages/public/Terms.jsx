import { Link } from 'react-router-dom';
import { PageHero } from '../../components/common/PageHeader';
import TermsContent from '../../components/legal/TermsContent';
import { termsSections, termsUpdated } from '../../components/legal/terms';
import useSeo from '../../hooks/useSeo';
import { breadcrumbLd } from '../../utils/seo';
import { t } from '../../i18n';

function jump(e, id) {
  e.preventDefault();
  document.getElementById(`terms-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Terms() {
  useSeo({ title: t('Terms & Conditions'), description: t('The terms for using MarketLink as a customer or farmer, and how your personal data is handled.'), jsonLd: breadcrumbLd([{ name: 'Terms & Conditions', path: '/terms' }]) });
  return (
    <>
      <PageHero
        crumbs={[{ label: t('Terms & Conditions') }]}
        title={t('Terms & Conditions')}
        subtitle={t('The simple rules that keep MarketLink fair for customers and farmers. Please read them before you create an account.')}
      >
        <span className="chip hero-chip">
          <i className="bi bi-calendar3" aria-hidden="true" /> {t('Last updated')} {termsUpdated()}
        </span>
      </PageHero>
      <div className="container pb-5">
        <div className="row g-4">
          <aside className="col-lg-3 d-none d-lg-block">
            <nav className="terms-toc" aria-label={t('Sections')}>
              <span className="eyebrow">{t('On this page')}</span>
              <ol>
                {termsSections().map((s) => (
                  <li key={s.id}>
                    <a href={`#terms-${s.id}`} onClick={(e) => jump(e, s.id)}>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
          <div className="col-lg-9">
            <details className="terms-toc-mobile d-lg-none">
              <summary>
                <i className="bi bi-list-ul" aria-hidden="true" /> {t('On this page')}
              </summary>
              <ol>
                {termsSections().map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#terms-${s.id}`}
                      onClick={(e) => {
                        e.currentTarget.closest('details')?.removeAttribute('open');
                        jump(e, s.id);
                      }}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
            <div className="terms-panel">
              <TermsContent />
              <div className="terms-foot">
                <p className="mb-0 small text-muted-2">{t('By creating an account you confirm that you have read and agree to these terms.')}</p>
                <div className="d-flex gap-2 flex-wrap">
                  <Link to="/register" className="btn btn-primary">
                    {t('Create an account')}
                  </Link>
                  <Link to="/contact" className="btn btn-white">
                    {t('Ask a question')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
