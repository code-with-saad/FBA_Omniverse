import { termsSections } from './terms';

/** The Terms & Conditions text, numbered, used on /terms and in the sign-up dialog. */
export default function TermsContent({ compact = false }) {
  return (
    <div className={`terms-content ${compact ? 'is-compact' : ''}`}>
      {termsSections().map((s, i) => (
        <section key={s.id} id={`terms-${s.id}`} className="terms-section">
          <h2 className="terms-title">
            <span className="terms-icon" aria-hidden="true">
              <i className={`bi ${s.icon}`} />
            </span>
            <span>
              {i + 1}. {s.title}
            </span>
          </h2>
          {s.body?.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {s.list && (
            <ul>
              {s.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
