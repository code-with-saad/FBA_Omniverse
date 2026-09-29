import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import LocationPicker from '../../components/map/LocationPicker';
import DayDots from '../../components/common/DayDots';
import { PageLoader } from '../../components/common/Loader';
import { DAY_NAMES, formatDateKey, time12, toDateKey } from '../../utils/format';
import SearchSelect from '../../components/common/SearchSelect';
import { t } from '../../i18n';
import SaveBar, { isChanged } from '../../components/common/SaveBar';

/** Markets the farmer sells at, weekly pickup windows, slot settings, cut-off and stall map pin. */
export default function FarmerPickup() {
  useDocumentTitle(t('Markets & pickup'));
  const { data } = useFetch('/farmer/me');
  const { data: marketData } = useFetch('/markets');
  if (!data || !marketData) return <PageLoader />;
  return <PickupEditor farmer={data.farmer} allMarkets={marketData.markets} />;
}

function PickupEditor({ farmer, allMarkets }) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(() => ({
    markets: farmer.markets.map((m) => m._id),
    windows: farmer.pickupWindows.map((w) => ({ market: w.market?._id || w.market, day: w.day, start: w.start, end: w.end })),
    settings: { slotMinutes: farmer.slotMinutes, slotCapacity: farmer.slotCapacity, orderCutoffHours: farmer.orderCutoffHours },
    blocked: farmer.blockedDates || [],
  }));
  const [markets, setMarkets] = useState(saved.markets);
  const [windows, setWindows] = useState(saved.windows);
  const [settings, setSettings] = useState(saved.settings);
  const [pin, setPin] = useState({ lat: farmer.latitude ?? '', lng: farmer.longitude ?? '' });
  const [blocked, setBlocked] = useState(saved.blocked);
  const [newDate, setNewDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  const marketById = Object.fromEntries(allMarkets.map((m) => [m._id, m]));

  function toggleMarket(id) {
    setMarkets((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    if (markets.includes(id)) setWindows((w) => w.filter((x) => x.market !== id));
  }

  function addWindow() {
    const market = markets[0] || allMarkets[0]?._id;
    const m = marketById[market];
    setWindows([...windows, { market, day: m?.operatingDays?.[0] ?? 6, start: m?.openTime || '08:00', end: m?.closeTime || '12:00' }]);
  }

  const dirty = isChanged({ markets, windows: windows.map((w) => ({ ...w, day: Number(w.day) })), settings, blocked }, { ...saved, windows: saved.windows.map((w) => ({ ...w, day: Number(w.day) })) });
  const cancel = () => {
    setMarkets(saved.markets);
    setWindows(saved.windows);
    setSettings(saved.settings);
    setBlocked(saved.blocked);
  };

  const updateWindow = (i, changes) => setWindows(windows.map((w, idx) => (idx === i ? { ...w, ...changes } : w)));

  async function save() {
    setBusy(true);
    try {
      const res = await api.put('/farmer/pickup', { markets, pickupWindows: windows, blockedDates: blocked, ...settings });
      setBlocked(res.farmer.blockedDates || []);
      setSaved({ markets, windows, settings, blocked: res.farmer.blockedDates || [] });
      toast(t('Pickup settings saved'));
      if (res.clashes) toast(t('{clashes} open pre-order(s) fall on a closed date. Please decline them or contact those customers', { clashes: res.clashes }), 'error');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function savePin() {
    setSavingPin(true);
    try {
      await api.upload('PUT', '/farmer/profile', (() => {
        const fd = new FormData();
        fd.append('latitude', pin.lat);
        fd.append('longitude', pin.lng);
        return fd;
      })());
      toast(t('Stall location saved'));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingPin(false);
    }
  }

  const outsideHours = (w) => {
    const m = marketById[w.market];
    return m && (!m.operatingDays.includes(Number(w.day)) || w.start < m.openTime || w.end > m.closeTime);
  };

  return (
    <>
      <DashHeader title={t('Markets & pickup')} subtitle={t('Choose where you sell, when customers can collect orders, and pin your stall on the map.')} />

      <div className="panel mb-4">
        <div className="panel-head">
          <h5>{t('1. Markets you sell at')}</h5>
        </div>
        <div className="row g-2">
          {allMarkets.map((m) => {
            const on = markets.includes(m._id);
            return (
              <div key={m._id} className="col-md-6 col-xl-4">
                <label className={`explore-item border ${on ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" className="form-check-input mt-1" checked={on} onChange={() => toggleMarket(m._id)} />
                  <span className="min-w-0">
                    <strong className="d-block small">{m.name}</strong>
                    <span className="fs-7 text-muted-2 d-block">
                      {t(m.city)} · {time12(m.openTime)} {t('to')} {time12(m.closeTime)}
                    </span>
                    <DayDots days={m.operatingDays} />
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel mb-4">
        <div className="panel-head">
          <div>
            <h5>{t('2. Weekly pickup windows')}</h5>
            <div className="fs-7 text-muted-2">{t('Customers choose a slot inside these windows at checkout.')}</div>
          </div>
          <button type="button" className="btn btn-soft btn-sm" onClick={addWindow} disabled={!markets.length}>
            <i className="bi bi-plus-lg" /> {t('Add window')}
          </button>
        </div>
        {!markets.length && <p className="small text-muted-2">{t('Select at least one market first.')}</p>}
        {windows.map((w, i) => (
          <div key={i}>
            <div className="window-row">
              <SearchSelect size="sm" value={w.market} onChange={(v) => updateWindow(i, { market: v })} ariaLabel={t('Market')} options={markets.map((id) => ({ value: id, label: marketById[id]?.name || t('Market') }))} />
              <select className="form-select form-select-sm" value={w.day} onChange={(e) => updateWindow(i, { day: Number(e.target.value) })} aria-label={t('Day')}>
                {DAY_NAMES.map((d, idx) => (
                  <option key={d} value={idx}>
                    {d}
                  </option>
                ))}
              </select>
              <input type="time" className="form-control form-control-sm" value={w.start} onChange={(e) => updateWindow(i, { start: e.target.value })} aria-label={t('Start time')} />
              <input type="time" className="form-control form-control-sm" value={w.end} onChange={(e) => updateWindow(i, { end: e.target.value })} aria-label={t('End time')} />
              <button type="button" className="btn btn-sm btn-white btn-icon" onClick={() => setWindows(windows.filter((_, idx) => idx !== i))} aria-label={t('Remove window')}>
                <i className="bi bi-trash3" />
              </button>
            </div>
            {outsideHours(w) && (
              <div className="fs-7 text-warning-emphasis mb-2">
                <i className="bi bi-exclamation-triangle" /> {t('This window is outside the market\'s days or opening hours.')}
              </div>
            )}
          </div>
        ))}

        <h6 className="mt-4">{t('3. Closed dates')}</h6>
        <p className="fs-7 text-muted-2 mb-2">{t('Not coming to the market on a certain day (holiday, harvest failed, closed for the week)? Add the date and customers can’t book pickups for it.')}</p>
        <div className="d-flex gap-2 flex-wrap align-items-center mb-2">
          <input type="date" className="form-control form-control-sm w-auto" min={toDateKey()} value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label={t('Closed date')} />
          <button
            type="button"
            className="btn btn-soft btn-sm"
            disabled={!newDate || blocked.includes(newDate)}
            onClick={() => {
              setBlocked([...blocked, newDate].sort());
              setNewDate('');
            }}
          >
            <i className="bi bi-calendar-x" /> {t('Add closed date')}
          </button>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {blocked.length === 0 && <span className="small text-muted-2">{t('No closed dates.')}</span>}
          {blocked.map((d) => (
            <span key={d} className="chip chip-danger">
              {formatDateKey(d, { withYear: true })}
              <button type="button" className="btn-close ms-1" style={{ fontSize: '.55rem' }} onClick={() => setBlocked(blocked.filter((x) => x !== d))} aria-label={t('Remove {d}', { d })} />
            </span>
          ))}
        </div>

        <h6 className="mt-4">{t('4. Slots & cut-off')}</h6>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="slotMinutes">{t('Slot length')}</label>
            <select id="slotMinutes" className="form-select" value={settings.slotMinutes} onChange={(e) => setSettings({ ...settings, slotMinutes: Number(e.target.value) })}>
              {[15, 20, 30, 45, 60, 90, 120].map((n) => (
                <option key={n} value={n}>
                  {n} {t('minutes')}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="slotCapacity">{t('Max orders per slot')}</label>
            <input id="slotCapacity" type="number" min="1" max="100" className="form-control" value={settings.slotCapacity} onChange={(e) => setSettings({ ...settings, slotCapacity: Number(e.target.value) })} />
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="cutoff">{t('Order cut-off (hours before slot)')}</label>
            <input id="cutoff" type="number" min="0" max="168" className="form-control" value={settings.orderCutoffHours} onChange={(e) => setSettings({ ...settings, orderCutoffHours: Number(e.target.value) })} />
          </div>
        </div>
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={save} onCancel={cancel} className="mb-4" />

      <div className="panel">
        <div className="panel-head">
          <div>
            <h5>{t('5. Stall location (map pin)')}</h5>
            <div className="fs-7 text-muted-2">{t('Shown to customers on the map with directions to your pickup point.')}</div>
          </div>
        </div>
        <LocationPicker lat={pin.lat} lng={pin.lng} onChange={(p) => setPin({ lat: p.lat, lng: p.lng })} height={340} />
        <div className="row g-2 mt-2 align-items-end">
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="lat">{t('Latitude')}</label>
            <input id="lat" type="number" step="0.000001" className="form-control" value={pin.lat} onChange={(e) => setPin({ ...pin, lat: e.target.value })} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="lng">{t('Longitude')}</label>
            <input id="lng" type="number" step="0.000001" className="form-control" value={pin.lng} onChange={(e) => setPin({ ...pin, lng: e.target.value })} />
          </div>
          <div className="col-md-3">
            <button type="button" className="btn btn-primary w-100" onClick={savePin} disabled={savingPin || pin.lat === '' || pin.lng === ''}>
              {t('Save location')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
