import { ORDER_STATUS_META, PRODUCT_STATUS_LABEL } from '../../utils/format';

export default function StatusBadge({ status, label }) {
  const raw = label || ORDER_STATUS_META[status]?.label || PRODUCT_STATUS_LABEL[status] || String(status || '');
  const text = raw.charAt(0).toUpperCase() + raw.slice(1);
  return (
    <span className={`status-badge s-${status}`}>
      <span className="dot" />
      {text}
    </span>
  );
}
