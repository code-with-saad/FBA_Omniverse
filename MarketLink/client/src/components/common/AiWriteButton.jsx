import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { isUrdu, t } from '../../i18n';


export default function AiWriteButton({ kind, context, onText, english = false, disabled = false, missing, className = '' }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [variant, setVariant] = useState(0);

  async function write() {
    const details = typeof context === 'function' ? context() : context || {};
    // `missing(details)` names what to fill in first (for example the question of an FAQ)
    const first = missing?.(details);
    if (first) {
      toast(first, 'warning');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/ai/write', { kind, context: details, lang: !english && isUrdu() ? 'ur' : 'en', variant });
      onText(res.text);
      setVariant((v) => v + 1);
      toast(res.source === 'claude' ? t('Written by AI (Claude). Check it and save.') : t('Written by the built-in AI. Check it and save.'), res.source === 'claude' ? 'success' : 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`btn btn-sm btn-ai ${className}`} onClick={write} disabled={busy || disabled}>
      {busy ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className="bi bi-stars" aria-hidden="true" />} {variant ? t('Try another') : t('Generate with AI')}
    </button>
  );
}
