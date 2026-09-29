import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import SearchSelect from '../common/SearchSelect';
import { t } from '../../i18n';

let cache = null;
let pending = null;

/** Lists for the admin filter dropdowns (cities, markets, farmers, categories), loaded once. */
export function useFilterOptions(enabled = true) {
  const [options, setOptions] = useState(cache);
  useEffect(() => {
    if (cache || !enabled) return undefined;
    let alive = true;
    pending ||= api.get('/admin/filter-options').then((d) => (cache = d));
    pending.then((d) => alive && setOptions(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return options || { cities: [], markets: [], farmers: [], categories: [] };
}

/** Forget the cached lists (after adding a city, market or farmer). */
export function resetFilterOptions() {
  cache = null;
  pending = null;
}

function listFor(source, options) {
  if (Array.isArray(source)) return source;
  if (source === 'cities') return options.cities.map((c) => ({ value: c.name, label: c.name }));
  if (source === 'markets') return options.markets.map((m) => ({ value: m._id, label: m.name }));
  if (source === 'farmers') return options.farmers.map((f) => ({ value: f._id, label: f.stallName }));
  if (source === 'categories') return options.categories.map((c) => ({ value: c._id, label: c.name }));
  return [];
}

/**
 * Compact row of filter controls for a DataGrid.
 * fields: [{ name, label, type: 'select' | 'date' | 'number', options: [...] | 'cities' | 'markets' | 'farmers' | 'categories' }]
 */
export default function FilterBar({ fields, value, onChange }) {
  // Admin lists are only loaded when a field needs them (farmer pages pass their own options)
  const options = useFilterOptions(fields.some((f) => typeof f.options === 'string'));
  const active = fields.filter((f) => value[f.name] !== '' && value[f.name] !== undefined).length;
  const set = (name, v) => onChange({ ...value, [name]: v });
  return (
    <div className="filter-bar" role="group" aria-label={t('Filters')}>
      {fields.map((f) => (
        <label key={f.name} className={`filter-field ${f.type === 'date' ? 'is-date' : ''} ${f.type === 'number' ? 'is-number' : ''} ${f.wide ? 'is-wide' : ''}`}>
          <span>{t(f.label)}</span>
          {f.type === 'date' || f.type === 'number' ? (
            <input type={f.type} className="form-control form-control-sm" value={value[f.name] ?? ''} min={f.type === 'number' ? 0 : undefined} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
          ) : (
            <SearchSelect size="sm" value={value[f.name] ?? ''} onChange={(v) => set(f.name, v)} options={listFor(f.options, options)} emptyLabel={f.all || t('All')} ariaLabel={t(f.label)} />
          )}
        </label>
      ))}
      {active > 0 && (
        <button type="button" className="btn btn-sm btn-link filter-reset" onClick={() => onChange({ ...value, ...Object.fromEntries(fields.map((f) => [f.name, ''])) })}>
          <i className="bi bi-x-circle" /> {active === 1 ? t('Clear 1 filter') : t('Clear {n} filters', { n: active })}
        </button>
      )}
    </div>
  );
}
