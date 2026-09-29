import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from 'datatables.net-react';
import DT from 'datatables.net-bs5';
import 'datatables.net-responsive-bs5';
import 'datatables.net-buttons-bs5';
import 'datatables.net-buttons/js/buttons.html5.mjs';
import 'datatables.net-buttons/js/buttons.print.mjs';
import JSZip from 'jszip';
import 'datatables.net-bs5/css/dataTables.bootstrap5.css';
import 'datatables.net-responsive-bs5/css/responsive.bootstrap5.css';
import 'datatables.net-buttons-bs5/css/buttons.bootstrap5.css';
import { api } from '../../api/client';
import { isUrdu, t } from '../../i18n';

DT.Buttons.jszip(JSZip); // Excel export
// A DataTables warning is for developers: log it in the console instead of an alert box
DT.ext.errMode = (settings, techNote, message) => console.warn(message);
// Tell the React component which DataTables build to use (named so the hooks linter does not mistake it for React's use())
const registerLibrary = DataTable.use;
registerLibrary(DT);

const LANGUAGE = {
  search: '',
  searchPlaceholder: 'Search…',
  lengthMenu: '_MENU_ per page',
  info: 'Showing _START_ to _END_ of _TOTAL_',
  infoEmpty: 'No rows',
  infoFiltered: '(filtered from _MAX_)',
  emptyTable: 'Nothing here yet',
  zeroRecords: 'No matching rows',
  processing: '<span class="spinner-border spinner-border-sm text-success"></span> Loading…',
  paginate: { first: '«', previous: '‹', next: '›', last: '»' },
  aria: { paging: 'Pagination', paginate: { first: 'First page', previous: 'Previous page', next: 'Next page', last: 'Last page' } },
};

// The texts above in the language in use (the admin area is always English)
const language = () => ({
  ...Object.fromEntries(Object.entries(LANGUAGE).map(([k, v]) => [k, typeof v === 'string' ? t(v) : v])),
  aria: { paging: t(LANGUAGE.aria.paging), paginate: Object.fromEntries(Object.entries(LANGUAGE.aria.paginate).map(([k, v]) => [k, t(v)])) },
});

/**
 * DataTables grid (datatables.net) with the MarketLink look.
 *  - `table`: name of a server-side table (POST /api/admin/tables/:table does paging, search and sorting)
 *  - or `data`: an array for a client-side table (e.g. analytics that are already calculated)
 * Cells are HTML strings (see utils/cells.js). Buttons with data-action call onAction(action, row);
 * links with data-href open inside the app. Export buttons: CSV, Excel and Print.
 */
export default function DataGrid({ table, data, columns, filters, order = [[0, 'desc']], pageLength = 10, exportName = t('MarketLink'), onAction, onEdit, reloadKey = 0, searchPlaceholder, className = '', emptyText }) {
  const ref = useRef(null);
  const wrap = useRef(null);
  const onEditRef = useRef(onEdit);
  const filtersRef = useRef(filters);
  const navigate = useNavigate();
  const filterKey = JSON.stringify(filters || {});
  const first = useRef(true);
  // Column headings in the language in use
  const cols = useMemo(() => columns.map((c) => (c.title ? { ...c, title: t(c.title) } : c)), [columns]);

  useEffect(() => {
    filtersRef.current = filters;
    onEditRef.current = onEdit;
  });

  // Inline editing: inputs and selects in cells with data-edit="field" call onEdit(field, row, value).
  // Number boxes save when they lose focus or on Enter.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const rowOf = (node) => {
      let tr = node.closest('tr');
      if (tr?.classList.contains('child')) tr = tr.previousElementSibling;
      return ref.current?.dt()?.row(tr).data();
    };
    const onChange = (e) => {
      const input = e.target.closest?.('[data-edit]');
      if (!input || !onEditRef.current) return;
      const row = rowOf(input);
      if (row) onEditRef.current(input.getAttribute('data-edit'), row, input.value, input);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Enter' && e.target.matches?.('input[data-edit]')) {
        e.preventDefault();
        e.target.blur();
      }
    };
    el.addEventListener('change', onChange);
    el.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('change', onChange);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Reload the server data when the filter controls or the reload key change
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (table) ref.current?.dt()?.ajax.reload();
  }, [filterKey, reloadKey, table]);

  const options = useMemo(
    () => ({
      serverSide: Boolean(table),
      processing: true,
      responsive: true,
      autoWidth: false,
      // Some cells read nested values that can be missing (e.g. "Reported by" for automatic flags
      // has no reporter). DataTables Responsive reads raw cell data without the renderer, so every
      // column falls back to an empty value instead of raising "Requested unknown parameter".
      columnDefs: [{ targets: '_all', defaultContent: '' }],
      order,
      pageLength,
      lengthMenu: [
        [10, 25, 50, 100, -1],
        [10, 25, 50, 100, t('All')],
      ],
      searchDelay: 350,
      language: { ...language(), ...(searchPlaceholder ? { searchPlaceholder } : {}), ...(emptyText ? { emptyTable: emptyText } : {}) },
      layout: {
        topStart: ['pageLength', { buttons: ['csv', 'excel', 'print'].map((type) => ({ extend: type === 'csv' ? 'csvHtml5' : type === 'excel' ? 'excelHtml5' : 'print', text: `<i class="bi ${type === 'csv' ? 'bi-filetype-csv' : type === 'excel' ? 'bi-file-earmark-excel' : 'bi-printer'}"></i> ${type === 'csv' ? 'CSV' : type === 'excel' ? t('Excel') : t('Print')}`, className: 'btn btn-sm btn-white', title: exportName, exportOptions: { columns: ':not(.no-export)', orthogonal: 'export' } })) }],
        topEnd: 'search',
        bottomStart: 'info',
        bottomEnd: 'paging',
      },
      // DataTables labels the page-number bar "pagination" itself; give it the Urdu label on the Urdu site
      drawCallback(settings) {
        if (isUrdu()) settings.tableWrapper?.querySelector('nav[aria-label="pagination"]')?.setAttribute('aria-label', t('Pagination'));
      },
      ...(table
        ? {
            ajax: (request, callback) => {
              api
                .post(`/admin/tables/${table}`, { ...request, filters: filtersRef.current || {} })
                .then(callback)
                .catch(() => callback({ draw: request.draw, recordsTotal: 0, recordsFiltered: 0, data: [] }));
            },
          }
        : {}),
    }),
    // The DataTable is created once; filters are read from a ref and trigger ajax.reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function handleClick(e) {
    const linkEl = e.target.closest('[data-href]');
    if (linkEl && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      navigate(linkEl.getAttribute('data-href'));
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn || !onAction) return;
    let tr = btn.closest('tr');
    // Responsive "child" rows (small screens) belong to the row above them
    if (tr?.classList.contains('child')) tr = tr.previousElementSibling;
    const row = ref.current?.dt()?.row(tr).data();
    if (!row || btn.classList.contains('is-busy')) return;
    const result = onAction(btn.getAttribute('data-action'), row, btn);
    // While an action that talks to the server runs, its button shows a spinner and cannot be pressed again
    if (result && typeof result.then === 'function') {
      btn.classList.add('is-busy');
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
      const spin = document.createElement('span');
      spin.className = 'spinner-border spinner-border-sm btn-spin';
      spin.setAttribute('aria-hidden', 'true');
      btn.prepend(spin);
      result.finally(() => {
        if (!btn.isConnected) return; // the table was redrawn with the new data
        spin.remove();
        btn.classList.remove('is-busy');
        btn.removeAttribute('aria-busy');
        btn.disabled = false;
      });
    }
  }

  return (
    <div className={`data-grid ${className}`} onClick={handleClick} ref={wrap}>
      <DataTable ref={ref} className="table table-hover align-middle w-100" columns={cols} data={table ? undefined : data} options={options} />
    </div>
  );
}
