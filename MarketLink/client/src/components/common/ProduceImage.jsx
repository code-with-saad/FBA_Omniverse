import { useState } from 'react';
import { imageKind } from '../../utils/images';

/**
 * Product / farmer photo on a soft coloured tile. The photo fills the tile; a basket icon shows
 * when there is no photo or it fails to load.
 */
export default function ProduceImage({ src, alt = '', color, className = '', style }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`produce-tile ${className}`} style={{ '--tile-bg': color || undefined, ...style }}>
      {src && !failed ? (
        <img src={src} alt={alt} loading="lazy" className={imageKind(src)} onError={() => setFailed(true)} />
      ) : (
        <i className="bi bi-basket2 tile-fallback" aria-hidden="true" />
      )}
    </div>
  );
}
