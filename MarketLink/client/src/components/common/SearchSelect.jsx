import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n';

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * A dropdown with a search box (replaces <select> for longer lists: cities, markets, farmers,
 * customers, categories ...). Keyboard: arrows, Enter, Escape; type to filter.
 *
 *   <SearchSelect id="city" value={city} onChange={setCity} options={[{ value, label, hint? }]} emptyLabel="All cities" />
 *
 * `emptyLabel` adds a first option with the value ''. `required` blocks form submission while empty.
 * Options with `disabled: true` are shown but cannot be chosen.
 */
export default function SearchSelect({
  id,
  value,
  onChange,
  options = [],
  emptyLabel,
  placeholder = t('Choose…'),
  searchPlaceholder = t('Search…'),
  size = '',
  className = '',
  required = false,
  disabled = false,
  ariaLabel,
}) {
  const autoId = useId();
  const listId = `${id || autoId}-list`;
  const trigger = useRef(null);
  const menu = useRef(null);
  const search = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  const all = useMemo(() => (emptyLabel !== undefined ? [{ value: '', label: t(emptyLabel) }, ...options] : options), [emptyLabel, options]);
  const selected = all.find((o) => String(o.value) === String(value ?? ''));
  const shown = useMemo(() => {
    const q = norm(query.trim());
    return q ? all.filter((o) => norm(o.label).includes(q) || norm(o.hint).includes(q)) : all;
  }, [all, query]);

  // The menu is drawn in <body> (so dialogs and scrolling panels never cut it off), next to the button
  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 300 && r.top > below;
    const width = Math.max(r.width, 220);
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width, top: up ? undefined : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : undefined });
  }, []);

  function openMenu() {
    if (disabled) return;
    place();
    setQuery('');
    setActive(Math.max(0, all.findIndex((o) => String(o.value) === String(value ?? ''))));
    setOpen(true);
  }

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  }, []);

  function choose(option) {
    if (option.disabled) return;
    // lets a dialog around it know that something was changed ("unsaved changes")
    if (String(option.value) !== String(value ?? '')) trigger.current?.dispatchEvent(new CustomEvent('ml-change', { bubbles: true }));
    onChange?.(option.value);
    close();
  }

  useLayoutEffect(() => {
    if (open) search.current?.focus();
  }, [open]);

  // Keep the highlighted option visible while moving with the arrow keys
  useEffect(() => {
    if (open) menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!menu.current?.contains(e.target) && !trigger.current?.contains(e.target)) close(false);
    };
    const onScroll = (e) => {
      if (!menu.current?.contains(e.target)) place();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place, close]);

  function onSearchKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // do not close a surrounding dialog
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  }

  function onTriggerKey(e) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      openMenu();
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      // start typing on the closed dropdown: open it with the letter already in the search box
      openMenu();
      setQuery(e.key);
    }
  }

  return (
    <div className={`search-select ${size ? `is-${size}` : ''} ${className}`}>
      <button
        type="button"
        id={id}
        ref={trigger}
        className={`form-select ss-trigger ${size === 'sm' ? 'form-select-sm' : size === 'lg' ? 'form-select-lg' : ''} ${selected && selected.value !== '' ? '' : 'is-empty'}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel ? `${ariaLabel}: ${selected?.label || placeholder}` : undefined}
      >
        <span className="ss-value">{selected ? selected.label : placeholder}</span>
      </button>
      {required && <input className="ss-native" tabIndex={-1} aria-hidden="true" required value={value ?? ''} onChange={() => {}} onFocus={() => trigger.current?.focus()} />}
      {open &&
        pos &&
        createPortal(
          <div className="ss-menu" ref={menu} style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}>
            <div className="ss-search">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                ref={search}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={ariaLabel ? t('Search {what}', { what: ariaLabel }) : t('Search options')}
                aria-controls={listId}
                aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKey}
              />
            </div>
            <ul className="ss-options" id={listId} role="listbox" aria-label={ariaLabel}>
              {shown.length === 0 && <li className="ss-none">{t('No matches')}</li>}
              {shown.map((o, i) => {
                const isSel = String(o.value) === String(value ?? '');
                return (
                  <li
                    key={`${o.value}`}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled || undefined}
                    className={`${i === active ? 'is-active' : ''} ${isSel ? 'is-selected' : ''} ${o.disabled ? 'is-disabled' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                  >
                    <span className="text-truncate">{t(o.label)}</span>
                    {o.hint && <span className="ss-hint">{o.hint}</span>}
                    {isSel && <i className="bi bi-check2 ms-auto" aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
