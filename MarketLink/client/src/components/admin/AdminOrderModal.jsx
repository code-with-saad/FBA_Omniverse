import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import QuantityStepper from '../common/QuantityStepper';
import ProduceImage from '../common/ProduceImage';
import PickupPicker from '../order/PickupPicker';
import { money } from '../../utils/format';
import SearchSelect from '../common/SearchSelect';
import { maxOf, minOf, qtyLabel, stepOf } from '../../utils/quantity';

/**
 * "Place order" for administrators (e.g. a customer who phones in): choose the customer,
 * the farmer, the items and a pickup slot. The server runs the same stock and slot checks
 * as the customer checkout and notifies both sides.
 */
export default function AdminOrderModal({ onClose, onPlaced }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: opts } = useFetch('/admin/order-options');
  const [customerId, setCustomerId] = useState('');
  const [farmerId, setFarmerId] = useState('');
  const [qty, setQty] = useState({});
  const [pickup, setPickup] = useState({ pickupDate: '', marketId: '', slotStart: '' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { data: prodData, loading: prodLoading } = useFetch(farmerId ? `/products?farmer=${farmerId}&limit=60&sort=name` : null);

  const customers = opts?.customers || [];
  const products = (prodData?.products || []).filter((p) => p.status === 'available' && p.quantityAvailable > 0);
  const chosen = products.filter((p) => qty[p._id] > 0);
  const total = chosen.reduce((s, p) => s + p.price * qty[p._id], 0);
  const customer = opts?.customers.find((c) => c._id === customerId);
  const ready = customerId && farmerId && chosen.length > 0 && pickup.slotStart;

  function chooseFarmer(id) {
    setFarmerId(id);
    setQty({});
    setPickup({ pickupDate: '', marketId: '', slotStart: '' });
  }

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/admin/orders', {
        customerId,
        groups: [{ farmerId, marketId: pickup.marketId, pickupDate: pickup.pickupDate, slotStart: pickup.slotStart, items: chosen.map((p) => ({ productId: p._id, quantity: qty[p._id] })), note }],
      });
      const order = res.orders[0];
      toast(`Pre-order ${order.orderNumber} placed for ${customer?.name}`);
      onPlaced?.(order);
      navigate(`/admin/orders/${order._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Place an order for a customer"
      size="modal-lg admin-order-modal"
      footer={
        <>
          <span className="me-auto align-self-center small">
            {chosen.length > 0 ? (
              <>
                {chosen.length} item{chosen.length > 1 ? 's' : ''} · <strong>{money(total)}</strong> <span className="text-muted-2">(paid at pickup)</span>
              </>
            ) : (
              <span className="text-muted-2">Choose a customer, a farmer and at least one item</span>
            )}
          </span>
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!ready || busy} onClick={submit}>
            {busy ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-bag-check" />} Place order
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger small py-2">{error}</div>}
      <div className="order-step">
        <div className="order-step-title">
          <span>1</span> Customer
        </div>
        <SearchSelect
          id="ao-customer"
          size="sm"
          value={customerId}
          onChange={setCustomerId}
          ariaLabel="Customer"
          placeholder={`Choose a customer (${customers.length})`}
          searchPlaceholder="Name, e-mail, phone or city"
          options={customers.map((c) => ({ value: c._id, label: c.name, hint: [c.email, c.phone, c.city].filter(Boolean).join(' · ') }))}
        />
        {customer && (
          <div className="fs-7 text-muted-2 mt-1">
            <i className="bi bi-telephone" /> {customer.phone}
          </div>
        )}
      </div>

      <div className="order-step">
        <div className="order-step-title">
          <span>2</span> Farmer / stall
        </div>
        <SearchSelect
          id="ao-farmer"
          size="sm"
          value={farmerId}
          onChange={chooseFarmer}
          ariaLabel="Farmer"
          placeholder="Choose a farmer"
          searchPlaceholder="Stall name or city"
          options={(opts?.farmers || []).map((f) => ({ value: f._id, label: f.stallName, hint: f.hasPickup ? f.city : `${f.city ? `${f.city} · ` : ''}no pickup times yet`, disabled: !f.hasPickup }))}
        />
      </div>

      {farmerId && (
        <div className="order-step">
          <div className="order-step-title">
            <span>3</span> Items
          </div>
          {prodLoading && !prodData ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : products.length === 0 ? (
            <p className="small text-muted-2 mb-0">This farmer has nothing in stock right now.</p>
          ) : (
            <div className="order-items">
              {products.map((p) => (
                <div key={p._id} className={`order-item ${qty[p._id] > 0 ? 'is-chosen' : ''}`}>
                  <ProduceImage src={p.image} alt="" color={p.category?.color} className="order-item-img" />
                  <div className="order-item-text">
                    <strong>{p.name}</strong>
                    <span>
                      {money(p.price)} / {p.unit} · {qtyLabel(p.quantityAvailable, p.unit)} left
                    </span>
                  </div>
                  {qty[p._id] > 0 ? (
                    <QuantityStepper size="sm" value={qty[p._id]} min={0} max={maxOf(p)} step={stepOf(p)} unit={p.unit} onChange={(n) => setQty({ ...qty, [p._id]: n })} label={`${p.name} quantity`} />
                  ) : (
                    <button type="button" className="btn btn-sm btn-soft" onClick={() => setQty({ ...qty, [p._id]: minOf(p) })}>
                      <i className="bi bi-plus-lg" /> Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {farmerId && chosen.length > 0 && (
        <div className="order-step">
          <div className="order-step-title">
            <span>4</span> Pickup
          </div>
          <PickupPicker farmerId={farmerId} value={pickup} onChange={setPickup} />
          <label className="form-label mt-2 small" htmlFor="order-note">
            Note for the farmer (optional)
          </label>
          <input id="order-note" className="form-control form-control-sm" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Ordered by phone" />
        </div>
      )}
    </Modal>
  );
}
