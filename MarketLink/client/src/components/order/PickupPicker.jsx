import useFetch from '../../hooks/useFetch';
import { DAY_SHORT, MONTHS, parseDateKey, time12 } from '../../utils/format';
import { t } from '../../i18n';
import { clashText, findClash } from '../../utils/pickupClash';

/**
 * Lets the customer choose a pickup date, then a market window and a time slot.
 * value = { pickupDate, marketId, slotStart }
 * busy: the customer's other pickups ({ date, marketId, start, farmer, market }); slots at another market less
 * than an hour from one of them cannot be chosen (nobody can be at two markets at once).
 */
export default function PickupPicker({ farmerId, value, onChange, excludeOrder, busy = [] }) {
  const { data, loading, error } = useFetch(`/farmers/${farmerId}/availability${excludeOrder ? `?excludeOrder=${excludeOrder}` : ''}`);
  const dates = data?.dates || [];
  // The first available date is selected until the customer picks another one
  const selectedDate = dates.some((d) => d.date === value.pickupDate) ? value.pickupDate : dates[0]?.date;
  const day = dates.find((d) => d.date === selectedDate);

  if (loading && !data) return <div className="skeleton" style={{ height: 150 }} />;
  if (error) return <div className="text-danger small">{error.message}</div>;
  if (!dates.length)
    return (
      <div className="alert alert-warning small mb-0">
        {t('This farmer has no open pickup slots in the next two weeks. Please remove these items or try again later.')}
      </div>
    );

  return (
    <div>
      <div className="small fw-bold mb-2">{t('1. Pickup date')}</div>
      <div className="date-chips mb-3" role="radiogroup" aria-label={t('Pickup date')}>
        {dates.map((d) => {
          const date = parseDateKey(d.date);
          return (
            <button
              type="button"
              key={d.date}
              className={selectedDate === d.date ? 'active' : ''}
              onClick={() => onChange({ pickupDate: d.date, marketId: '', slotStart: '' })}
              role="radio"
              aria-checked={selectedDate === d.date}
            >
              <div className="dow">{DAY_SHORT[date.getDay()]}</div>
              <div className="dnum">{date.getDate()}</div>
              <div className="mon">{MONTHS[date.getMonth()]}</div>
            </button>
          );
        })}
      </div>
      {day && (
        <>
          <div className="small fw-bold mb-2">{t('2. Time slot')}</div>
          {(() => {
            // one line that explains the "Other pickup" slots of this day
            const first = day.windows.flatMap((w) => w.slots.map((s) => findClash({ date: selectedDate, marketId: w.market._id, start: s.start }, busy))).find(Boolean);
            return first ? (
              <p className="clash-note">
                <i className="bi bi-info-circle" aria-hidden="true" /> {t('Slots marked "Other pickup" are less than an hour from your pickup from {what}, which is at another market.', { what: clashText(first) })}
              </p>
            ) : null;
          })()}
          {day.windows.map((w) => (
            <div key={w.market._id + w.start} className="mb-3">
              <div className="small text-muted-2 mb-2">
                <i className="bi bi-geo-alt-fill text-success" /> <strong className="text-forest">{w.market.name}</strong> · {time12(w.start)} {t('to')} {time12(w.end)}
              </div>
              <div className="slot-grid">
                {w.slots.map((s) => {
                  const active = value.pickupDate === selectedDate && value.slotStart === s.start && value.marketId === w.market._id;
                  const clash = s.available && findClash({ date: selectedDate, marketId: w.market._id, start: s.start }, busy);
                  return (
                    <button
                      type="button"
                      key={s.start}
                      disabled={!s.available || Boolean(clash)}
                      className={`${active ? 'active' : ''} ${clash ? 'is-clash' : ''}`}
                      onClick={() => onChange({ pickupDate: selectedDate, marketId: w.market._id, slotStart: s.start, marketName: w.market.name })}
                      aria-pressed={active}
                      title={clash ? t('You collect from {what}. Nobody can be at two markets at once.', { what: clashText(clash) }) : undefined}
                    >
                      {time12(s.start)}
                      <small>{clash ? t('Other pickup') : s.available ? t('{n} left', { n: s.remaining }) : s.remaining === 0 ? t('Full') : t('Closed')}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
