import { Fragment, useState } from 'react';
import { localText } from '../../i18n';

/** An answer: paragraphs split on blank lines; lines starting with "1." become a numbered list. */
export function FaqAnswer({ text }) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block, i) => {
      const lines = block.split('\n').filter(Boolean);
      if (lines.length > 1 && lines.every((l) => /^\d+[.۔]\s/.test(l))) {
        return (
          <ol key={i}>
            {lines.map((l) => (
              <li key={l}>{l.replace(/^\d+[.۔]\s/, '')}</li>
            ))}
          </ol>
        );
      }
      return (
        <p key={i}>
          {lines.map((l, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {l}
            </Fragment>
          ))}
        </p>
      );
    });
}

/**
 * Questions as an accordion: one answer open at a time (opening a question closes the one that was open)
 * and the answer slides open smoothly. The answers stay in the page for search engines; a closed one is
 * hidden from screen readers and the keyboard.
 * `openFirst` opens the first question; `idPrefix` gives every question a link target (#faq-...).
 * `openId` + `onToggle` let a page share one open question between several lists.
 */
export default function FaqList({ faqs, openFirst = false, idPrefix = 'faq', openId, onToggle }) {
  const ids = faqs.map((f, i) => `${idPrefix}-${f._id || i}`);
  const [ownOpen, setOwnOpen] = useState(() => {
    const fromLink = typeof window !== 'undefined' && window.location.hash.slice(1);
    if (fromLink && ids.includes(fromLink)) return fromLink;
    return openFirst ? ids[0] : null;
  });
  const controlled = onToggle !== undefined;
  const open = controlled ? openId : ownOpen;
  const toggle = (id) => {
    const next = open === id ? null : id;
    if (controlled) onToggle(next);
    else setOwnOpen(next);
  };

  return (
    <div className="faq-list">
      {faqs.map((f, i) => {
        const id = ids[i];
        const isOpen = open === id;
        return (
          <div key={id} className={`faq-item ${isOpen ? 'is-open' : ''}`} id={id}>
            <h3 className="faq-heading">
              <button type="button" className="faq-summary" aria-expanded={isOpen} aria-controls={`${id}-answer`} onClick={() => toggle(id)}>
                <span className="faq-q">{localText(f, 'question')}</span>
                <i className="bi bi-plus-lg faq-toggle" aria-hidden="true" />
              </button>
            </h3>
            <div className="faq-panel" id={`${id}-answer`} role="region" aria-label={localText(f, 'question')} aria-hidden={!isOpen} inert={!isOpen}>
              <div className="faq-panel-inner">
                <div className="faq-a">
                  <FaqAnswer text={localText(f, 'answer')} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
