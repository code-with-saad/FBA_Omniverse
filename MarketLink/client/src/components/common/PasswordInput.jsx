import { useState } from 'react';
import { t } from '../../i18n';

/**
 * Password box with one show / hide (eye) button inside the field.
 * The browser's own reveal button (Edge) is hidden in CSS, so there is never a second eye.
 */
export default function PasswordInput({ id, size = '', className = '', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`pass-field ${size ? `pass-field-${size}` : ''}`}>
      <input id={id} type={show ? 'text' : 'password'} className={`form-control ${size ? `form-control-${size}` : ''} ${className}`} {...props} />
      <button type="button" className="pass-eye" onClick={() => setShow(!show)} aria-label={show ? t('Hide password') : t('Show password')} aria-controls={id} aria-pressed={show}>
        <i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
      </button>
    </div>
  );
}
