// Links shared by the desktop navbar, the mobile drawer and the account dropdown.
export const LINKS = [
  { to: '/', label: 'Home', icon: 'bi-house', end: true },
  { to: '/products', label: 'Shop', icon: 'bi-shop' },
  { to: '/markets', label: 'Markets', icon: 'bi-geo-alt' },
  { to: '/farmers', label: 'Farmers', icon: 'bi-people' },
  { to: '/map', label: 'Map', icon: 'bi-map' },
  { to: '/about', label: 'About', icon: 'bi-info-circle' },
  { to: '/faq', label: 'FAQs', icon: 'bi-question-circle', menuOnly: true }, // phone menu only (the desktop bar is full)
  { to: '/contact', label: 'Contact', icon: 'bi-envelope' },
];

export const MENUS = {
  customer: [
    { to: '/account', icon: 'bi-grid', label: 'My dashboard' },
    { to: '/account/orders', icon: 'bi-bag', label: 'My orders' },
    { to: '/account/favorites', icon: 'bi-heart', label: 'Favourites' },
    { to: '/account/profile', icon: 'bi-person', label: 'Profile & family' },
  ],
  farmer: [
    { to: '/farmer', icon: 'bi-graph-up', label: 'Dashboard & insights' },
    { to: '/farmer/orders', icon: 'bi-receipt', label: 'Pre-orders', approved: true },
    { to: '/farmer/products', icon: 'bi-basket', label: 'Products & Pricing', approved: true },
    { to: '/farmer/pickup', icon: 'bi-geo-alt', label: 'Markets & pickup', approved: true },
    { to: '/farmer/profile', icon: 'bi-shop-window', label: 'Stall profile' },
  ],
  admin: [
    { to: '/admin', icon: 'bi-speedometer2', label: 'Admin dashboard' },
    { to: '/admin/farmers', icon: 'bi-shop', label: 'Farmers' },
    { to: '/admin/reports', icon: 'bi-file-earmark-bar-graph', label: 'Reports' },
  ],
};

/**
 * Farmers waiting for approval (or suspended) only see their dashboard, stall profile and
 * notifications; selling features (stock, pre-orders, pickup, reviews) are hidden until approved.
 */
export const canSell = (user) => user?.role !== 'farmer' || user.status === 'active';
export const visibleItems = (items, user) => (canSell(user) ? items : items.filter((i) => !i.approved));

// Role names shown on the account chip (translated where they are drawn)
export const ROLE_LABEL = { customer: 'Customer', farmer: 'Farmer', admin: 'Admin' };
