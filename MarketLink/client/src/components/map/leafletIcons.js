import L from 'leaflet';

const cache = new Map();

/** Custom pin markers built with HTML/CSS (no image files needed). */
export function pinIcon({ type = 'market', image, selected = false } = {}) {
  const key = `${type}|${image}|${selected}`;
  if (cache.has(key)) return cache.get(key);
  const size = type === 'farmer' ? 36 : 42;
  const inner = image ? `<img src="${image}" alt="" />` : `<i class="bi ${type === 'farmer' ? 'bi-shop' : 'bi-basket2-fill'}"></i>`;
  const icon = L.divIcon({
    className: '',
    html: `<div class="ml-marker ${type} ${selected ? 'selected' : ''}">${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size + 4],
    popupAnchor: [0, -size],
  });
  cache.set(key, icon);
  return icon;
}

export const userIcon = L.divIcon({
  className: '',
  html: '<div class="ml-marker user"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
