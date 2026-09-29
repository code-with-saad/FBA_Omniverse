import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clampQty, maxOf, roundQty, stepOf } from '../utils/quantity';

const CartContext = createContext(null);
const STORAGE_KEY = 'marketlink_cart_v1';

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/**
 * Shopping cart kept in the browser (localStorage). Each line:
 * { productId, slug, name, price, unit, image, categoryColor, maxQty, quantity, sellByWeight, minQuantity, maxPerOrder, farmer: { _id, stallName, slug, logo } }
 * `quantity` is a number of units, or of kg / litres for products sold by weight (0.25 = 250 g).
 * Items are grouped by farmer at checkout because every farmer has its own pickup slot.
 */
export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  const [drawerOpen, setDrawerOpen] = useState(false); // basket sidebar on the right
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage may be unavailable (private mode) - the cart still works for this visit */
    }
  }, [items]);

  const add = useCallback((product, quantity = 1) => {
    setItems((list) => {
      const id = String(product._id);
      const maxQty = product.quantityAvailable ?? 999;
      const rules = { sellByWeight: Boolean(product.sellByWeight), minQuantity: product.minQuantity || 1, maxPerOrder: product.maxPerOrder || 0 };
      const existing = list.find((i) => i.productId === id);
      if (existing) {
        return list.map((i) => (i.productId === id ? { ...i, ...rules, maxQty, quantity: clampQty(i.quantity + quantity, rules, maxQty) } : i));
      }
      const farmer = product.farmer || {};
      return [
        ...list,
        {
          productId: id,
          slug: product.slug,
          name: product.name,
          nameUr: product.nameUr,
          price: product.price,
          unit: product.unit,
          image: product.image,
          categoryColor: product.category?.color,
          maxQty,
          ...rules,
          quantity: clampQty(quantity, rules, maxQty),
          farmer: { _id: String(farmer._id || farmer), stallName: farmer.stallName, slug: farmer.slug, logo: farmer.logo },
        },
      ];
    });
  }, []);

  const update = useCallback((productId, quantity) => {
    setItems((list) =>
      list.map((i) => (i.productId === productId ? { ...i, quantity: clampQty(quantity, i, i.maxQty || 999) } : i))
    );
  }, []);

  // How many more of a product fit in the basket (the farmer's stock minus what is already in it)
  const roomFor = useCallback(
    (product) => {
      const inBasket = items.find((i) => i.productId === String(product._id))?.quantity || 0;
      // the stock and the farmer's per-order limit, in whole steps
      return Math.max(0, roundQty(Math.floor((maxOf(product) - inBasket) / stepOf(product) + 1e-9) * stepOf(product)));
    },
    [items]
  );

  const remove = useCallback((productId) => setItems((list) => list.filter((i) => i.productId !== productId)), []);
  const removeFarmer = useCallback((farmerId) => setItems((list) => list.filter((i) => i.farmer._id !== farmerId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const groups = [];
    for (const item of items) {
      let group = groups.find((g) => g.farmer._id === item.farmer._id);
      if (!group) {
        group = { farmer: item.farmer, items: [], subtotal: 0 };
        groups.push(group);
      }
      group.items.push(item);
      group.subtotal += item.price * item.quantity;
    }
    return {
      items,
      groups,
      // products sold by weight count as one line each (a basket badge of "2.75" would make no sense)
      count: items.reduce((s, i) => s + (i.sellByWeight ? 1 : i.quantity), 0),
      total: items.reduce((s, i) => s + i.price * i.quantity, 0),
      add,
      roomFor,
      update,
      remove,
      removeFarmer,
      clear,
      has: (productId) => items.some((i) => i.productId === String(productId)),
      drawerOpen,
      openDrawer,
      closeDrawer,
    };
  }, [items, add, roomFor, update, remove, removeFarmer, clear, drawerOpen, openDrawer, closeDrawer]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
