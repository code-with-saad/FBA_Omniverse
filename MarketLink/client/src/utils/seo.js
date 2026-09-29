import { localText } from '../i18n';

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const abs = (url) => (!url ? undefined : /^https?:\/\//.test(url) ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`);
const rating = (x) => (x.ratingCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: x.ratingAvg, reviewCount: x.ratingCount, bestRating: 5, worstRating: 1 } } : {});

export function productLd(product) {
  const url = abs(`/products/${product.slug}`);
  const inStock = product.status === 'available' && product.quantityAvailable > 0;
  const ai = product.aiSchema || {};
  const now = new Date();
  const prop = (name, value) => (value ? { '@type': 'PropertyValue', name, value } : null);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    alternateName: product.nameUr || undefined,
    description: product.description || ai.summary || undefined,
    disambiguatingDescription: ai.summary || undefined,
    image: [product.image, ...(product.gallery || []).map((g) => g.url)].filter(Boolean).map(abs),
    sku: product._id,
    category: product.category?.name ? `Fresh food > ${product.category.name}` : undefined,
    keywords: product.keywords?.length ? product.keywords.join(', ') : undefined,
    url,
    brand: { '@type': 'Brand', name: product.farmer?.stallName },
    countryOfOrigin: { '@type': 'Country', name: 'Pakistan' },
    additionalProperty: [
      prop('Season', ai.season),
      prop('Storage', ai.storage),
      prop('Best for', ai.uses),
      prop('Grown in', product.farmer?.city),
      prop('Farming practice', product.farmer?.tags?.length ? product.farmer.tags.join(', ') : ''),
      prop('Sold per', product.unit),
      prop('Payment', 'Cash to the farmer at pickup'),
    ].filter(Boolean),
    offers: {
      '@type': 'Offer',
      url,
      price: product.price,
      priceCurrency: 'PKR',
      priceValidUntil: new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      availableDeliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModePickUp',
      eligibleQuantity: { '@type': 'QuantitativeValue', unitText: product.unit },
      seller: { '@type': 'Organization', name: product.farmer?.stallName, url: abs(`/farmers/${product.farmer?.slug}`) },
    },
    ...rating(product),
  };
}

export function farmerLd(farmer) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: farmer.stallName,
    description: farmer.bio || undefined,
    image: abs(farmer.logo),
    url: abs(`/farmers/${farmer.slug}`),
    address: { '@type': 'PostalAddress', streetAddress: farmer.address, addressLocality: farmer.city || undefined, addressCountry: 'PK' },
    ...(farmer.latitude ? { geo: { '@type': 'GeoCoordinates', latitude: farmer.latitude, longitude: farmer.longitude } } : {}),
    ...rating(farmer),
  };
}

export function marketLd(market) {
  const days = (market.operatingDays || []).map((d) => DAY[d]);
  return {
    '@context': 'https://schema.org',
    '@type': ['Place', 'LocalBusiness'],
    name: market.name,
    description: market.description || undefined,
    image: abs(market.image),
    url: abs(`/markets/${market.slug}`),
    address: { '@type': 'PostalAddress', streetAddress: market.address, addressLocality: market.city || undefined, addressCountry: 'PK' },
    geo: { '@type': 'GeoCoordinates', latitude: market.latitude, longitude: market.longitude },
    ...(days.length ? { openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: days, opens: market.openTime, closes: market.closeTime }] } : {}),
  };
}

export const clip = (s, n = 160) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : t;
};

export function productDescription(p) {
  if (p.metaDescription) return clip(p.metaDescription);
  const text = String(p.description || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length >= 70) return clip(text);
  return clip(`${/[.!?]$/.test(text) ? text : `${text}.`} ${p.name} from ${p.farmer?.stallName}, Rs ${p.price} per ${p.unit}. Pre-order on MarketLink and pay at the stall when you pick it up.`);
}

const plain = (s) => String(s || '').replace(/\n{2,}/g, '\n').trim();

export function faqLd(faqs) {
  if (!faqs?.length) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: localText(f, 'question'), acceptedAnswer: { '@type': 'Answer', text: plain(localText(f, 'answer')) } })),
  };
}
export function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...items].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.path) })),
  };
}

export function ldGraph(...items) {
  const list = items.flat().filter(Boolean).map(({ '@context': _c, ...rest }) => rest);
  return list.length ? { '@context': 'https://schema.org', '@graph': list } : undefined;
}

export function itemListLd(name, items) {
  if (!items?.length) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: abs(it.path) })),
  };
}

const HOW_IT_WORKS = [
  ['Find fresh produce', 'Browse this week’s stock by category, market, farmer or pickup day.'],
  ['Add to your basket', 'Press Add on a product, choose how many and add it to the basket. One basket can hold several farmers.'],
  ['Pick a pickup slot', 'At checkout choose the market, day and time window for each farmer. No account is needed: guests get one automatically.'],
  ['Collect and pay at the stall', 'Show your order number at the stall on market day and pay the farmer in cash.'],
];

export function homeLd(faqs) {
  return ldGraph(
    faqLd(faqs),
    {
      '@type': 'HowTo',
      name: 'How to pre-order fresh produce on MarketLink',
      totalTime: 'PT5M',
      step: HOW_IT_WORKS.map(([name, text], i) => ({ '@type': 'HowToStep', position: i + 1, name, text })),
    },
    {
      '@type': 'VideoObject',
      name: 'How MarketLink works',
      description: 'A 30-second tour: find fresh produce, pre-order, pick a pickup time and pay the farmer at the market.',
      thumbnailUrl: abs('/media/how-it-works.jpg'),
      contentUrl: abs('/media/how-it-works.mp4'),
      uploadDate: '2026-09-25',
      duration: 'PT29S',
    }
  );
}
