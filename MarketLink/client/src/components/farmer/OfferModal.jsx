import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import { formatDateKey, money, offerPercent, toDateKey } from '../../utils/format';
import { productName, t, unitName } from '../../i18n';

export const OFFER_CHOICES = [10, 20, 25, 30, 40, 50];

const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toDateKey(d);
};

/** The last day of an offer as a date key ("2026-10-04"), or '' when it has no end date. */
export const offerEndKey = (product) => (product?.offerEndsAt ? toDateKey(new Date(product.offerEndsAt)) : '');

/** The price after a discount, rounded to whole rupees like the server does. */
export const priceAfter = (usual, percent) => Math.max(1, Math.round(Number(usual) * (1 - Number(percent) / 100)));

/**
 * "Put on offer" for one product: pick 10%, 20%, 30% ... off (or type any 5-90%), optionally the last
 * day of the offer, and see the new price before saving. A product already on offer can be changed or ended.
 */
export default function OfferModal({ product, onClose, onSaved }) {
  const { toast } = useToast();
  const current = offerPercent(product);
  const usual = current ? product.compareAtPrice : product.price;
  const [percent, setPercent] = useState(current || 20);
  const [custom, setCustom] = useState(current && !OFFER_CHOICES.includes(current) ? String(current) : '');
  const [endsOn, setEndsOn] = useState(offerEndKey(product));
  const [busy, setBusy] = useState('');

  const chosen = custom !== '' ? Number(custom) : percent;
  const valid = chosen >= 5 && chosen <= 90;
  const newPrice = valid ? priceAfter(usual, chosen) : null;
  const unit = unitName(product.unit);

  async function save(end = false) {
    setBusy(end ? 'end' : 'save');
    try {
      const res = await api.patch(`/farmer/products/${product._id}/offer`, end ? { end: true } : { percent: chosen, endsOn });
      toast(
        end
          ? t('Offer ended. {name} is back to {price}.', { name: productName(product), price: money(res.product.price) })
          : t('{n}% off {name}', { n: Math.round(chosen), name: productName(product) })
      );
      onSaved(res.product);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  const ends = [
    ['', t('No end date')],
    [inDays(2), t('3 days')],
    [inDays(6), t('1 week')],
    [inDays(13), t('2 weeks')],
  ];

  return (
    <Modal
      open
      dirty={chosen !== (current || 20) || endsOn !== offerEndKey(product)}
      onClose={onClose}
      title={current ? t('Change the offer on {name}', { name: productName(product) }) : t('Put {name} on offer', { name: productName(product) })}
      footer={
        <>
          {current > 0 && (
            <button type="button" className="btn btn-outline-danger me-auto" onClick={() => save(true)} disabled={Boolean(busy)}>
              {busy === 'end' ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-x-circle" aria-hidden="true" />} {t('End offer')}
            </button>
          )}
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose} disabled={Boolean(busy)}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => save(false)} disabled={!valid || Boolean(busy)}>
            {busy === 'save' ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-tag" aria-hidden="true" />} {current ? t('Save offer') : t('Start offer')}
          </button>
        </>
      }
    >
      <div className="offer-modal">
        <p className="small text-muted-2 mb-3">{t('Usual price: {price} per {unit}', { price: money(usual), unit })}</p>

        <span className="form-label d-block" id="om-percent">
          {t('How much off?')}
        </span>
        <div className="offer-choices" role="group" aria-labelledby="om-percent">
          {OFFER_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              className={`offer-choice ${custom === '' && percent === n ? 'active' : ''}`}
              aria-pressed={custom === '' && percent === n}
              onClick={() => {
                setPercent(n);
                setCustom('');
              }}
            >
              {t('{n}% off', { n })}
            </button>
          ))}
          <label className={`offer-choice offer-custom ${custom !== '' ? 'active' : ''}`}>
            <span className="visually-hidden">{t('Other discount in percent')}</span>
            <input type="number" min="5" max="90" inputMode="numeric" placeholder={t('Other')} value={custom} onChange={(e) => setCustom(e.target.value)} />
            <span aria-hidden="true">%</span>
          </label>
        </div>
        {!valid && <div className="small text-danger mt-1">{t('Choose a discount between 5% and 90%')}</div>}

        <div className="offer-preview" aria-live="polite">
          {valid ? (
            <>
              <span className="offer-preview-now">
                {money(newPrice)}{' '}
                <small>
                  {t('per')} {unit}
                </small>
              </span>
              <del className="price-was">{money(usual)}</del>
              <span className="chip chip-deal">{t('{n}% off', { n: offerPercent({ price: newPrice, compareAtPrice: usual }) })}</span>
              <span className="offer-preview-note">{t('This is what customers see on your product.')}</span>
            </>
          ) : (
            <span className="text-muted-2">{t('Pick a discount to see the new price.')}</span>
          )}
        </div>

        <span className="form-label d-block mt-3" id="om-ends">
          {t('Offer ends')}
        </span>
        <div className="offer-choices" role="group" aria-labelledby="om-ends">
          {ends.map(([key, label]) => (
            <button key={label} type="button" className={`offer-choice ${endsOn === key ? 'active' : ''}`} aria-pressed={endsOn === key} onClick={() => setEndsOn(key)}>
              {label}
            </button>
          ))}
          <label className={`offer-choice offer-date ${endsOn && !ends.some(([k]) => k === endsOn) ? 'active' : ''}`}>
            <span className="visually-hidden">{t('Last day of the offer')}</span>
            <input type="date" min={toDateKey()} max={inDays(89)} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </label>
        </div>
        <div className="form-text">{endsOn ? t('The offer ends by itself after {date} and the usual price comes back.', { date: formatDateKey(endsOn) }) : t('The offer stays until you end it.')}</div>
      </div>
    </Modal>
  );
}
