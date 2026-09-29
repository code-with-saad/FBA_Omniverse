import { useEffect, useRef } from 'react';
import intlTelInput from 'intl-tel-input';
import 'intl-tel-input/styles';
import { isUrdu, t } from '../../i18n';

/**
 * Phone number box with a country flag and dial code (intl-tel-input). Pakistan is chosen first; people
 * can pick another country or type "+44 …". The number is passed on in international form ("+923001234567"),
 * and `onChange` receives an event-like object ({ target: { name, value } }) like a normal input.
 */
export default function PhoneInput({ id, name = 'phone', value = '', onChange, required = false, className = 'form-control', autoComplete = 'tel', placeholder }) {
  const input = useRef(null);
  const iti = useRef(null);
  const latest = useRef(onChange);
  // The whole number with the country code (+923001234567); the box itself shows the dial code separately
  // (getNumber() needs the number rules, which load a moment after the page; until then the typed text is used)
  const fullNumber = () => {
    const el = input.current;
    if (!el?.value.trim()) return '';
    if (!intlTelInput.utils) return el.value.trim();
    try {
      return iti.current?.getNumber() || el.value.trim();
    } catch {
      return el.value.trim();
    }
  };
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    const el = input.current;
    iti.current = intlTelInput(el, {
      initialCountry: 'pk',
      countryOrder: ['pk', 'ae', 'sa', 'gb', 'us'],
      formatAsYouType: true,
      autoPlaceholder: 'aggressive',
      loadUtils: () => import('intl-tel-input/utils'),
      i18n: isUrdu() ? { searchPlaceholder: t('Search'), noCountrySelected: t('Choose a country') } : undefined,
      countrySearch: true,
      containerClass: 'ml-phone',
    });
    const emit = () => latest.current?.({ target: { name, value: fullNumber() } });
    el.addEventListener('countrychange', emit);
    return () => {
      el.removeEventListener('countrychange', emit);
      iti.current?.destroy();
    };
  }, [name]);

  // A value set from outside (e.g. the saved profile) is shown in the box
  useEffect(() => {
    const el = input.current;
    if (el && (value || '') !== fullNumber()) iti.current?.setNumber(value || '');
  }, [value]);

  return (
    <input
      ref={input}
      id={id}
      name={name}
      type="tel"
      dir="ltr"
      className={className}
      required={required}
      defaultValue={value}
      onInput={() => onChange?.({ target: { name, value: fullNumber() } })}
      autoComplete={autoComplete}
      placeholder={placeholder}
      minLength={7}
      maxLength={20}
    />
  );
}
