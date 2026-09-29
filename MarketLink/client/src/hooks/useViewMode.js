import { useState } from 'react';

/**
 * "Table" or "Cards" view of a list, remembered in this browser. Phones start with cards,
 * bigger screens with the table (DataTables). `fallback` sets another first view (e.g. "grid" / "list").
 */
export default function useViewMode(key, fallback) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(`marketlink_view_${key}`);
      if (['table', 'cards', 'grid', 'list'].includes(saved)) return saved;
    } catch {
      /* storage blocked */
    }
    if (fallback) return fallback;
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table';
  });
  function change(next) {
    setMode(next);
    try {
      localStorage.setItem(`marketlink_view_${key}`, next);
    } catch {
      /* storage blocked */
    }
  }
  return [mode, change];
}
