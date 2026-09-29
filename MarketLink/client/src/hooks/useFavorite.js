import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { t } from '../i18n';

const FIELDS = { farmers: 'favoriteFarmers', products: 'favoriteProducts', markets: 'savedMarkets' };
// Toast texts per list: [added, removed]
const SAVED = { farmers: ['Added to favourite farmers', 'Removed from favourite farmers'], products: ['Added to favourites', 'Removed from favourites'], markets: ['Added to saved markets', 'Removed from saved markets'] };

/** Favourite / save toggle shared by product, farmer and market cards. */
export default function useFavorite(type, id) {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const field = FIELDS[type];
  const active = Boolean(user?.[field]?.some((x) => String(x) === String(id)));

  async function toggle(event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!user) {
      toast(t('Please log in as a customer to save favourites'), 'warning');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (user.role !== 'customer') {
      toast(t('Favourites are available for customer accounts'), 'warning');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/customer/favorites/${type}/${id}`);
      setUser((u) => ({ ...u, [field]: res.ids }));
      toast(t(SAVED[type][res.saved ? 0 : 1]), res.saved ? 'success' : 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return { active, toggle, busy };
}
