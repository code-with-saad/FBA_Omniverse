import { t } from '../../i18n';
export default function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  const numbers = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i += 1) numbers.push(i);
  return (
    <nav aria-label={t('Pagination')} className="d-flex justify-content-center mt-4">
      <ul className="pagination mb-0">
        <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
          <button type="button" className="page-link" onClick={() => onChange(page - 1)} aria-label={t('Previous page')}>
            <i className="bi bi-chevron-left" />
          </button>
        </li>
        {numbers[0] > 1 && (
          <li className="page-item disabled">
            <span className="page-link">…</span>
          </li>
        )}
        {numbers.map((n) => (
          <li key={n} className={`page-item ${n === page ? 'active' : ''}`}>
            <button type="button" className="page-link" onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}>
              {n}
            </button>
          </li>
        ))}
        {numbers[numbers.length - 1] < pages && (
          <li className="page-item disabled">
            <span className="page-link">…</span>
          </li>
        )}
        <li className={`page-item ${page >= pages ? 'disabled' : ''}`}>
          <button type="button" className="page-link" onClick={() => onChange(page + 1)} aria-label={t('Next page')}>
            <i className="bi bi-chevron-right" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
