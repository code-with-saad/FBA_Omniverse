import { initials } from '../../utils/format';

/** Round user picture: the uploaded profile photo, or the person's initials. */
export default function Avatar({ name, src, className = '' }) {
  return (
    <span className={`avatar ${src ? 'has-photo' : ''} ${className}`.trim()}>
      {src ? <img src={src} alt="" loading="lazy" /> : initials(name)}
    </span>
  );
}
