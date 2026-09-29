import { t } from '../../i18n';
/** Switch between the table (DataTables) and the simple card list. */
export default function ViewToggle({ value, onChange }) {
  return (
    <div className="view-toggle" role="group" aria-label={t('How to show the list')}>
      <button type="button" className={value === 'table' ? 'active' : ''} aria-pressed={value === 'table'} onClick={() => onChange('table')}>
        <i className="bi bi-table" aria-hidden="true" /> {t('Table')}
      </button>
      <button type="button" className={value === 'cards' ? 'active' : ''} aria-pressed={value === 'cards'} onClick={() => onChange('cards')}>
        <i className="bi bi-view-stacked" aria-hidden="true" /> {t('Cards')}
      </button>
    </div>
  );
}
