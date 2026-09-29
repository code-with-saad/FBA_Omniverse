import { money, offerPercent } from '../../utils/format';
import { t } from '../../i18n';

/** The usual price struck through and the saving ("30% off") of a product on offer; nothing otherwise. */
export default function OfferTag({ product }) {
  const off = offerPercent(product);
  if (!off) return null;
  return (
    <span className="offer-tag">
      <del className="price-was">
        <span className="visually-hidden">{t('Usual price')} </span>
        {money(product.compareAtPrice)}
      </del>
      <span className="chip chip-deal">{t('{n}% off', { n: off })}</span>
    </span>
  );
}
