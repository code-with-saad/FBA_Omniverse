import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useSeo from '../../hooks/useSeo';
import { PageHero } from '../../components/common/PageHeader';
import { Bone } from '../../components/common/Skeletons';
import { categoryName, t } from '../../i18n';


export default function Categories() {
  useSeo({
    title: t('Shop by category'),
    description: t("Vegetables, fruit, dairy, bakery, honey, grains and more from local farmers. Pick a category to see this week's produce."),
    canonicalPath: '/categories',
  });
  const { data, loading } = useFetch('/categories');
  const categories = data?.categories || [];
  const total = categories.reduce((n, c) => n + (c.productCount || 0), 0);
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Shop', to: '/products' }, { label: 'Categories' }]}
        title={t('Shop by category')}
        subtitle={t('{n} products from local farmers this week, sorted into {c} categories.', { n: total, c: categories.length })}
      />
      <div className="container pb-5">
        <div className="cat-grid-page">
          {loading && !data
            ? Array.from({ length: 8 }, (_, i) => <Bone key={i} h={260} r="1.1rem" />)
            : categories.map((c) => (
                <Link key={c._id} to={`/products?category=${c.slug}`} className="cat-tile" style={{ '--cat-bg': c.color }}>
                  <img src={c.image || c.icon} alt="" loading="lazy" />
                  <span className="cat-tile-body">
                    <strong>{categoryName(c)}</strong>
                    <span>{t('{n} items', { n: c.productCount })}</span>
                  </span>
                  <span className="cat-tile-go" aria-hidden="true">
                    <i className="bi bi-arrow-right" />
                  </span>
                </Link>
              ))}
        </div>
        <div className="text-center mt-4">
          <Link to="/products" className="btn btn-primary btn-lg">
            {t('Shop all products')} <i className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  );
}
