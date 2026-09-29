import { t } from '../../i18n';
import { qtyLabel, roundQty } from '../../utils/quantity';

/**
 * − / + with the amount in the middle. `step` 1 for pieces; for products sold by weight the step is the smallest
 * amount (0.25 = 250 g) and the amount is shown as "250 g" / "1.5 kg" (`unit`).
 */
export default function QuantityStepper({ value, onChange, min = 1, max = 999, step = 1, unit, size = '', label = t('Quantity') }) {
  const byWeight = step !== 1 || (unit && !Number.isInteger(value));
  const snap = (n) => {
    const q = roundQty(Math.round(Number.isFinite(n) ? n / step : min / step) * step);
    return Math.max(min, Math.min(max, q));
  };
  const set = (n) => onChange(snap(n));
  return (
    <div className={`qty-stepper ${size} ${byWeight ? 'is-weight' : ''}`}>
      <button type="button" onClick={() => set(roundQty(value - step))} disabled={value <= min + 1e-9} aria-label={t('Decrease quantity')}>
        <i className="bi bi-dash" />
      </button>
      {byWeight ? (
        <span className="qty-value" role="status" aria-label={label}>
          {qtyLabel(value, unit)}
        </span>
      ) : (
        <input type="number" value={value} min={min} max={max} step={step} aria-label={label} onChange={(e) => set(parseFloat(e.target.value))} />
      )}
      <button type="button" onClick={() => set(roundQty(value + step))} disabled={value >= max - 1e-9} aria-label={t('Increase quantity')}>
        <i className="bi bi-plus" />
      </button>
    </div>
  );
}

/** Quick amounts for a product sold by weight (250 g, 500 g, 1 kg …). */
export function WeightChips({ choices, value, unit, onChange }) {
  if (!choices?.length) return null;
  return (
    <div className="weight-chips" role="group" aria-label={t('Quick amounts')}>
      {choices.map((q) => (
        <button key={q} type="button" className={`weight-chip ${Math.abs(q - value) < 1e-9 ? 'active' : ''}`} onClick={() => onChange(q)} aria-pressed={Math.abs(q - value) < 1e-9}>
          {qtyLabel(q, unit)}
        </button>
      ))}
    </div>
  );
}
