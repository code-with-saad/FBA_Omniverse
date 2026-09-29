import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { t } from '../../i18n';

/**
 * The Urdu for an English box from the server (Claude with an API key, otherwise the built-in writer):
 * { text, complete, source, message }. `kind`: name | product-description | farm-bio | market-description | text.
 */
export const fetchUrdu = (kind, text, details, variant = 0) => api.post('/ai/urdu', { kind, text, details, variant });

/**
 * Fills an empty Urdu box from the English one (on blur of the English box). Names are filled only when every
 * word could be translated; nothing happens when the Urdu box already has text.
 */
export async function autoUrdu({ kind, text, details, current, onText }) {
  if (String(current || '').trim() || String(text || '').trim().length < 2) return;
  try {
    const res = await fetchUrdu(kind, text, details);
    if (res.text && (res.complete || kind !== 'name')) onText(res.text);
  } catch {
    // the button next to the box still works; nothing to tell here
  }
}

/** "Write in Urdu": a small button above an Urdu box that fills it from the English text. */
export default function UrduButton({ kind, text, details, onText, disabled = false, className = '', compact = false }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [variant, setVariant] = useState(0);

  async function write() {
    if (kind !== 'farm-bio' && kind !== 'market-description' && kind !== 'product-description' && String(text || '').trim().length < 2) {
      toast(t('Type the English text first'), 'warning');
      return;
    }
    setBusy(true);
    try {
      const res = await fetchUrdu(kind, text, details, variant);
      if (res.text) {
        onText(res.text);
        setVariant((v) => v + 1);
        // let an open dialog know the text changed (for "unsaved changes")
        document.activeElement?.dispatchEvent(new CustomEvent('ml-change', { bubbles: true }));
      }
      if (res.message) toast(t(res.message), res.text ? 'info' : 'warning');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-sm btn-ai btn-urdu ${compact ? 'is-compact' : ''} ${className}`}
      onClick={write}
      disabled={busy || disabled}
      title={compact ? t('Write in Urdu') : undefined}
      aria-label={compact ? t('Write in Urdu') : undefined}
    >
      {busy ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-translate" aria-hidden="true" />} {!compact && t('Write in Urdu')}
    </button>
  );
}
