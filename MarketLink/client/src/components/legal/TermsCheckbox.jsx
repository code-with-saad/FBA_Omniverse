import { useState } from 'react';
import Modal from '../common/Modal';
import TermsContent from './TermsContent';
import { termsUpdated } from './terms';
import { t } from '../../i18n';

/**
 * Required "I agree" checkbox for the sign-up forms. The terms open in a dialog,
 * so nothing typed in the form is lost; "I agree" in the dialog ticks the box.
 */
export default function TermsCheckbox({ id, checked, onChange, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="form-check terms-check">
        <input id={id} type="checkbox" className="form-check-input" checked={checked} onChange={(e) => onChange(e.target.checked)} required />
        <label className="form-check-label small" htmlFor={id}>
          {children}{t('I agree to the MarketLink')}{' '}
          <button type="button" className="btn-inline-link" onClick={() => setOpen(true)}>
            {t('Terms & Conditions')}
          </button>{' '}
          {t('and privacy notice.')}
        </label>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('Terms & Conditions')}
        size="modal-lg terms-modal"
        guardChanges={false}
        footer={
          <>
            <span className="me-auto small text-muted-2 align-self-center">{t('Last updated')} {termsUpdated()}</span>
            <button type="button" className="btn btn-white" onClick={() => setOpen(false)}>
              {t('Close')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onChange(true);
                setOpen(false);
              }}
            >
              <i className="bi bi-check2-circle" aria-hidden="true" /> {t('I agree')}
            </button>
          </>
        }
      >
        <TermsContent compact />
      </Modal>
    </>
  );
}
