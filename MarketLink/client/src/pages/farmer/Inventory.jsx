import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { api, toQuery } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { DashHeader } from '../../components/common/PageHeader';
import KpiCard from '../../components/common/KpiCard';
import Modal from '../../components/common/Modal';
import { PageLoader } from '../../components/common/Loader';
import DataGrid from '../../components/admin/DataGrid';
import FilterBar from '../../components/admin/FilterBar';
import { action, dateCell, display, esc, moneyCell, muted } from '../../utils/cells';
import { money, moneyCompact } from '../../utils/format';
import { categoryName, productName, t, tServer, unitName } from '../../i18n';
import RefreshButton from '../../components/common/RefreshButton';

const STATE = {
  ok: ['In stock', 's-available'],
  low: ['Low stock', 's-placed'],
  out: ['Sold out', 's-sold_out'],
  unavailable: ['Unavailable', 's-unavailable'],
  removed: ['Removed', 's-removed'],
};

const TYPE_LABEL = {
  initial: 'New product',
  restock: 'Restock',
  adjustment: 'Edited',
  waste: 'Damaged / spoiled',
  stall_sale: 'Sold at stall',
  correction: 'Correction',
  template: 'Weekly template',
  order_reserved: 'Pre-order',
  order_released: 'Order cancelled',
  order_changed: 'Order changed',
};

const iconAction = (name, label, icon) => `<button type="button" class="btn btn-sm btn-white btn-icon" data-action="${name}" aria-label="${label}" title="${label}"><i class="bi ${icon}"></i></button>`;
const stateBadge = (s) => `<span class="status-badge ${STATE[s][1]}"><span class="dot"></span>${t(STATE[s][0])}</span>`;

const COLUMNS = [
  {
    data: 'name',
    title: 'Product',
    responsivePriority: 1,
    render: display((v, p) => `<div class="d-flex align-items-center gap-2"><span class="thumb-sm" style="background:${esc(p.category?.color || '#f1ebdd')}"><img src="${esc(p.image || '')}" alt=""></span><div class="min-w-0"><strong class="small d-block">${esc(productName(p))}</strong>${muted(categoryName(p.category))}</div></div>`),
  },
  {
    data: 'quantityAvailable',
    title: 'In stock',
    className: 'text-end',
    responsivePriority: 2,
    render: display((v, p) => `<strong class="${p.state === 'low' || p.state === 'out' ? 'text-danger' : ''}">${esc(v)}</strong> <span class="fs-7 text-muted-2">${esc(unitName(p.unit))}</span>`),
  },
  { data: 'reserved', title: 'Reserved', className: 'text-end', render: display((v, p) => (v ? `${esc(v)} <span class="fs-7 text-muted-2">${esc(unitName(p.unit))}</span>` : '<span class="text-muted-2">-</span>')) },
  { data: 'lowStockThreshold', title: 'Alert at', className: 'text-end', render: display((v, p) => `${esc(v)} <span class="fs-7 text-muted-2">${esc(unitName(p.unit))}</span>`) },
  { data: 'state', title: 'Status', responsivePriority: 3, render: display((v) => stateBadge(v), (v) => t(STATE[v][0])) },
  { data: 'totalSold', title: 'Sold', className: 'text-end' },
  { data: 'value', title: 'Stock value', className: 'text-end', render: display(moneyCell) },
  { data: 'lastMovementAt', title: 'Last change', render: display((v) => dateCell(v, true)) },
  {
    data: null,
    title: 'Actions',
    orderable: false,
    className: 'text-end text-nowrap no-export',
    responsivePriority: 2,
    render: (v, tx, p) => (p.isRemoved ? '' : [action('adjust', t('Adjust'), 'btn-soft', 'bi-plus-slash-minus'), iconAction('alert', t('Low-stock alert level'), 'bi-bell'), iconAction('log', t('Stock history'), 'bi-clock-history')].join(' ')),
  },
];

const LOG_COLUMNS = [
  { data: 'createdAt', title: 'When', render: display((v) => dateCell(v, true)) },
  { data: 'productName', title: 'Product', render: display((v, m) => `<strong class="small">${esc(productName({ name: v, nameUr: m.productNameUr }))}</strong>`) },
  { data: 'change', title: 'Change', className: 'text-end', render: display((v, m) => `<strong class="${v > 0 ? 'text-success' : 'text-danger'}">${v > 0 ? '+' : ''}${esc(v)}</strong> <span class="fs-7 text-muted-2">${esc(unitName(m.unit) || '')}</span>`) },
  { data: 'quantityAfter', title: 'Stock after', className: 'text-end' },
  { data: 'type', title: 'Type', render: display((v) => `<span class="chip chip-soft">${esc(t(TYPE_LABEL[v] || v))}</span>`, (v) => t(TYPE_LABEL[v] || v)) },
  { data: 'reason', title: 'Details', orderable: false, className: 'dt-comment', render: display((v) => `<span class="small">${esc(v ? tServer(v) : '-')}</span>`) },
  { data: 'by', title: 'By', render: display((v) => `<span class="small text-capitalize">${esc(t(v))}</span>`) },
];

function AdjustModal({ product, reasons, onClose, onSaved }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('restock');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const q = Number(quantity) || 0;
  const after = mode === 'add' ? product.quantityAvailable + q : mode === 'remove' ? product.quantityAvailable - q : q;
  const reasonKeys = mode === 'add' ? ['restock', 'correction', 'adjustment'] : mode === 'remove' ? ['stall_sale', 'waste', 'correction', 'adjustment'] : ['correction', 'restock', 'adjustment'];

  function pickMode(m) {
    setMode(m);
    setReason(m === 'add' ? 'restock' : m === 'remove' ? 'stall_sale' : 'correction');
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/farmer/inventory/${product._id}/adjust`, { mode, quantity: q, reason, note });
      toast(res.message);
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('Adjust stock: {name}', { name: productName(product) })}
      footer={
        <>
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" form="adjust-form" className="btn btn-primary" disabled={busy || quantity === '' || after < 0}>
            {busy && <span className="spinner-border spinner-border-sm" />} {t('Save')}
          </button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={save} className="d-grid gap-3">
        <div className="tabs-pill">
          {[
            ['add', t('Add stock')],
            ['remove', t('Remove stock')],
            ['set', t('Set exact count')],
          ].map(([v, l]) => (
            <button key={v} type="button" className={mode === v ? 'active' : ''} onClick={() => pickMode(v)}>
              {l}
            </button>
          ))}
        </div>
        <div className="row g-2">
          <div className="col-5">
            <label className="form-label" htmlFor="adj-qty">
              {mode === 'set' ? t('New count') : t('Quantity')} ({unitName(product.unit)})
            </label>
            <input id="adj-qty" type="number" min="0" step="1" className="form-control" required value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
          </div>
          <div className="col-7">
            <label className="form-label" htmlFor="adj-reason">{t('Reason')}</label>
            <select id="adj-reason" className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasonKeys.map((k) => (
                <option key={k} value={k}>
                  {reasons[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="adj-note">{t('Note (optional)')}</label>
          <input id="adj-note" className="form-control" maxLength={150} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. second picking from the north field')} />
        </div>
        <div className={`stock-preview ${after < 0 ? 'is-bad' : after <= product.lowStockThreshold ? 'is-low' : ''}`}>
          <span>{t('Now')}</span>
          <strong>
            {product.quantityAvailable} {unitName(product.unit)}
          </strong>
          <i className="bi bi-arrow-right" aria-hidden="true" />
          <span>{t('After')}</span>
          <strong>{after < 0 ? t('not enough stock') : `${after} ${unitName(product.unit)}`}</strong>
          {after >= 0 && after <= product.lowStockThreshold && <span className="chip chip-warn ms-auto">{t('at alert level')}</span>}
        </div>
        {product.reserved > 0 && (
          <p className="fs-7 text-muted-2 mb-0">
            <i className="bi bi-info-circle" /> {t('{n} {unit} are already reserved for open pre-orders and are not part of this count.', { n: product.reserved, unit: unitName(product.unit) })}
          </p>
        )}
      </form>
    </Modal>
  );
}

function AlertModal({ product, onClose, onSaved }) {
  const { toast } = useToast();
  const [level, setLevel] = useState(String(product.lowStockThreshold));
  async function save(e) {
    e.preventDefault();
    try {
      await api.put(`/farmer/inventory/${product._id}/threshold`, { lowStockThreshold: Number(level) });
      toast(t('Alert level for {name} saved', { name: productName(product) }));
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Low-stock alert: {name}', { name: productName(product) })}
      footer={
        <>
          <button type="button" data-modal-cancel className="btn btn-white" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" form="alert-form" className="btn btn-primary">
            {t('Save alert level')}
          </button>
        </>
      }
    >
      <form id="alert-form" onSubmit={save}>
        <label className="form-label" htmlFor="alert-level">
          {t('Alert me when stock is at or below ({unit})', { unit: unitName(product.unit) })}
        </label>
        <input id="alert-level" type="number" min="0" step="1" className="form-control" required value={level} onChange={(e) => setLevel(e.target.value)} />
        <p className="fs-7 text-muted-2 mt-2 mb-0">{t('You get an e-mail and a notification once when the stock reaches this level. Use 0 to be told only when it is sold out.')}</p>
      </form>
    </Modal>
  );
}

/** Farmer inventory: stock levels, reserved stock, alert levels, manual adjustments and the full stock log. */
export default function FarmerInventory() {
  useDocumentTitle(t('Inventory'));
  const { refreshBadges } = useOutletContext() || {};
  const { data, loading, reload } = useFetch('/farmer/inventory');
  const [logFilters, setLogFilters] = useState({ product: '', type: '', from: '', to: '' });
  const { data: log, reload: reloadLog } = useFetch(`/farmer/inventory/movements${toQuery(logFilters)}`);
  const [adjusting, setAdjusting] = useState(null);
  const [alerting, setAlerting] = useState(null);
  const logFields = useMemo(
    () => [
      { name: 'product', label: t('Product'), options: (data?.products || []).map((p) => ({ value: p._id, label: productName(p) })) },
      { name: 'type', label: t('Type'), options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })) },
      { name: 'from', label: t('From'), type: 'date' },
      { name: 'to', label: t('To'), type: 'date' },
    ],
    [data]
  );

  if (loading && !data) return <PageLoader />;
  const { totals, products, reasons } = data;
  const lowOnes = products.filter((p) => p.state === 'low' || p.state === 'out');
  const saved = () => {
    setAdjusting(null);
    setAlerting(null);
    reload();
    reloadLog();
    refreshBadges?.();
  };

  function onAction(name, product) {
    if (name === 'adjust') setAdjusting(product);
    if (name === 'alert') setAlerting(product);
    if (name === 'log') {
      setLogFilters((f) => ({ ...f, product: product._id }));
      document.getElementById('stock-log')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <>
      <DashHeader
        title={t('Inventory')}
        subtitle={t('Stock on hand, what open pre-orders have reserved, alert levels and every stock change.')}
        actions={
          <>
            <RefreshButton
              onRefresh={() => {
                reload();
                reloadLog();
              }}
              loading={loading}
              className="btn-sm"
            />
            <Link to="/farmer/products" className="btn btn-white btn-sm">
              <i className="bi bi-basket" /> {t('Products & Pricing')}
            </Link>
          </>
        }
      />
      <div className="row g-2 g-xl-3 mb-3 kpi-row">
        <div className="col-6 col-md-4 col-xl-2">
          <KpiCard variant="accent" icon="bi-box-seam" label={t('Products')} value={totals.products} />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <KpiCard icon="bi-stack" label={t('Units in stock')} value={totals.units} />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <KpiCard variant="info" icon="bi-cash-stack" label={t('Stock value')} value={moneyCompact(totals.value)} />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <KpiCard icon="bi-bag-check" label={t('Reserved')} value={totals.reserved} sub={t('for pre-orders')} />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <KpiCard variant="warn" icon="bi-exclamation-triangle" label={t('Low stock')} value={totals.low} />
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <KpiCard variant="danger" icon="bi-x-octagon" label={t('Sold out')} value={totals.out} />
        </div>
      </div>

      {lowOnes.length > 0 && (
        <div className="approval-banner low-stock-banner">
          <span className="banner-icon" aria-hidden="true">
            <i className="bi bi-bell-fill" />
          </span>
          <div className="flex-grow-1">
            <strong>
              {lowOnes.length === 1 ? t('1 product is at or below the alert level') : t('{n} products are at or below the alert level', { n: lowOnes.length })}
            </strong>
            <div className="small text-muted-2">{lowOnes.map((p) => `${productName(p)} (${p.quantityAvailable} ${unitName(p.unit)})`).join(' · ')}</div>
          </div>
          <button type="button" className="btn btn-forest btn-sm" onClick={() => setAdjusting(lowOnes[0])}>
            {t('Restock {name}', { name: productName(lowOnes[0]) })}
          </button>
        </div>
      )}

      <div className="table-card mb-3">
        <DataGrid data={products} columns={COLUMNS} order={[[1, 'asc']]} exportName="Inventory" onAction={onAction} searchPlaceholder={t('Search products…')} />
      </div>

      <div className="table-card" id="stock-log">
        <div className="panel-head px-3 pt-3">
          <h5>
            <i className="bi bi-clock-history" /> {t('Stock log')}
          </h5>
          <span className="fs-7 text-muted-2">{t('every change: pre-orders, cancellations, the weekly template and your own adjustments')}</span>
        </div>
        <FilterBar fields={logFields} value={logFilters} onChange={setLogFilters} />
        <DataGrid data={log?.movements || []} columns={LOG_COLUMNS} order={[[0, 'desc']]} exportName="Stock log" searchPlaceholder={t('Search the log…')} />
      </div>
      <p className="fs-7 text-muted-2 mt-2 mb-0">
        {t('Stock value = price × units in stock ({value}). Low-stock alerts are sent by e-mail and as a notification.', { value: money(totals.value) })}
      </p>

      {adjusting && <AdjustModal product={adjusting} reasons={reasons} onClose={() => setAdjusting(null)} onSaved={saved} />}
      {alerting && <AlertModal product={alerting} onClose={() => setAlerting(null)} onSaved={saved} />}
    </>
  );
}
