import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useSeo from '../../hooks/useSeo';
import { PageHero } from '../../components/common/PageHeader';
import { PageLoader } from '../../components/common/Loader';
import HERO_CREDITS from '../../components/home/heroCredits.json';
import { isUrdu, t } from '../../i18n';

const BANNERS = Object.entries(HERO_CREDITS).map(([file, c]) => ({
  name: file
    .split('/')
    .pop()
    .replace(/\.webp$/, '')
    .replace(/-/g, ' '),
  credits: [].concat(c).map((one) => ({ ...one, license: 'CC BY 2.0' })),
}));

function CreditList({ title, items }) {
  if (!items?.length) return null;
  return (
    <section className="credits-group">
      <h2 className="h5">{title}</h2>
      <ul className="credits-list">
        {items.map((item) => (
          <li key={item.link || item.name}>
            <strong>{item.link ? <Link to={item.link}>{isUrdu() && item.nameUr ? item.nameUr : item.name}</Link> : <span className="text-capitalize">{item.name}</span>}</strong>
            <span>
              {item.credits.map((c, i) => (
                <span key={c.source || i} className="credit-line">
                  {c.source ? (
                    <a href={c.source} target="_blank" rel="noreferrer">
                      {c.author}
                    </a>
                  ) : (
                    c.author
                  )}
                  {c.license && <span className="text-muted-2"> · {c.license}</span>}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PhotoCredits() {
  useSeo({ title: t('Photo credits'), description: t('The photographers of the stock photos used on MarketLink and their licences.'), canonicalPath: '/credits' });
  const { data, loading } = useFetch('/credits');
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Photo credits' }]}
        title={t('Photo credits')}
        subtitle={t('Many photos on MarketLink come from photographers who share their work under Creative Commons licences. Thank you!')}
      />
      <div className="container pb-5 credits-page">
        <p className="text-muted-2">
          {t('Photos taken by farmers themselves are not listed. Licence details:')}{' '}
          <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">
            CC BY 2.0
          </a>
        </p>
        <CreditList title={t('Home page banners')} items={BANNERS} />
        {loading && !data ? (
          <PageLoader />
        ) : (
          <>
            <CreditList title={t('Markets')} items={data?.markets} />
            <CreditList title={t('Farmers')} items={data?.farmers} />
            <CreditList title={t('Products')} items={data?.products} />
          </>
        )}
      </div>
    </>
  );
}
