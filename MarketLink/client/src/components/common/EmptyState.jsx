/** Friendly "nothing here yet" box with an icon, a title, an optional message and an action. */
export default function EmptyState({ icon = 'bi-basket2', title, message, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        <i className={`bi ${icon}`} />
      </span>
      <h5>{title}</h5>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
