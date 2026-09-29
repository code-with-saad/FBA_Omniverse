export const APP_NAME = 'MarketLink';
export const CURRENCY = import.meta.env.VITE_CURRENCY || 'Rs';
export const API_BASE = import.meta.env.VITE_API_URL || '/api';

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const TILE_PROVIDERS = [
  { name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTRIBUTION, maxZoom: 19 },
  {
    name: 'CARTO',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
    maxZoom: 19,
  },
];
export const DEFAULT_CENTER = [24.8607, 67.0011];

export const CONTACT = {
  email: 'noreplyy.support@gmail.com',
  phone: '+92 335 3132747',
  address: 'Aptech Learning Centre, F.B. Area, Karachi',
  hours: 'Mon to Sat, 9:00 am to 6:00 pm',
  mapQuery: 'Aptech Learning Centre, Federal B Area, Karachi',
  latitude: 24.928,
  longitude: 67.0682,
};


export const SOCIAL = [
  { name: 'Facebook', icon: 'bi-facebook', url: 'https://www.facebook.com/profile.php?id=61594963763287' },
  { name: 'Instagram', icon: 'bi-instagram', url: 'https://www.instagram.com/marketlink.st/' },
  { name: 'X (Twitter)', icon: 'bi-twitter-x', url: 'https://x.com' },
  { name: 'YouTube', icon: 'bi-youtube', url: 'https://www.youtube.com' },
  { name: 'WhatsApp', icon: 'bi-whatsapp', url: 'https://wa.me/+923353132747' },
  { name: 'LinkedIn', icon: 'bi-linkedin', url: 'linkedin.com' },
];

export const TEAM_NAME = 'Team Omniverse';
export const TEAM_PLACE = 'Aptech Learning Centre, F.B. Area, Karachi';

export const TEAM = [
  { name: 'Muhammad Saad Dosani', area: 'Team lead · Backend', role: 'Node / Express API, security and e-mails', icon: 'bi-hdd-network', github: 'https://github.com/code-with-saad' },
  { name: 'Ghulam Mustafa', area: 'Frontend · UI design', role: 'React pages, design system and animations', icon: 'bi-palette', github: 'https://github.com/gulam603' },
  { name: 'Fahad Musa', area: 'Database · Testing', role: 'MongoDB schema, demo data and test runs', icon: 'bi-database-check', github: 'https://github.com/fahadmusa725' },
  { name: 'Muhammad Hamza', area: 'Maps · Documentation', role: 'Leaflet maps, routes, AI assistant and docs', icon: 'bi-map', github: '' },
];