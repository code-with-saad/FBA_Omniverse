export default function KpiCard({ icon, label, value, sub, variant = '' }) {
  return (
    <div className={`kpi-card ${variant}`}>
      <div className="kpi-icon">
        <i className={`bi ${icon}`} />
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
