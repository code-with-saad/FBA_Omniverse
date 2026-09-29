import { useSyncExternalStore } from 'react';

/** true while the CSS media query matches, e.g. useMediaQuery('(min-width: 992px)'); follows window resizes. */
export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
