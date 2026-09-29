import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';

/**
 * Search box that searches while you type: `onSearch` runs a moment after the last key press
 * (`delay` ms, straight away on Enter) and the × button clears the box. `value` is the search in use,
 * so the box follows the page when the search changes elsewhere (e.g. "Clear filters").
 */
export default function SearchBox({ value = '', onSearch, placeholder, label, delay = 350, id, className = '', autoFocus = false }) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  const input = useRef(null);
  // A new outside value (the URL changed) replaces what is typed
  if (synced !== value) {
    setSynced(value);
    setText(value);
  }

  useEffect(() => {
    if (text.trim() === value.trim()) return undefined;
    const timer = setTimeout(() => onSearch(text.trim()), delay);
    return () => clearTimeout(timer);
  }, [text, value, delay, onSearch]);

  function clear() {
    setText('');
    onSearch('');
    input.current?.focus();
  }

  return (
    <form
      className={`search-pill search-box ${className}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(text.trim());
      }}
    >
      <i className="bi bi-search" aria-hidden="true" />
      <input ref={input} id={id} type="text" inputMode="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label || placeholder} autoFocus={autoFocus} enterKeyHint="search" />
      {text && (
        <button type="button" className="search-clear" onClick={clear} aria-label={t('Clear search')}>
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
