import { useEffect, useState } from 'react';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER } from '../../config';
import BaseTiles from './BaseTiles';
import { pinIcon } from './leafletIcons';
import { getCurrentPosition } from './DirectionsMap';
import { t } from '../../i18n';

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }) });
  return null;
}

function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], Math.max(map.getZoom(), 14));
  }, [position, map]);
  return null;
}

/** Click on the map (or drag the pin) to set latitude / longitude. */
export default function LocationPicker({ lat, lng, onChange, height = 300 }) {
  const [recenter, setRecenter] = useState(null);
  const [error, setError] = useState('');
  const hasPoint = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== '' && lng !== '';
  const position = hasPoint ? [Number(lat), Number(lng)] : null;

  async function useMyLocation() {
    setError('');
    try {
      const me = await getCurrentPosition();
      const p = { lat: +me.lat.toFixed(6), lng: +me.lng.toFixed(6) };
      onChange(p);
      setRecenter(p);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="map-frame" style={{ height }}>
        <MapContainer center={position || DEFAULT_CENTER} zoom={position ? 14 : 11} style={{ height: '100%' }} scrollWheelZoom>
          <BaseTiles />
          <ClickHandler onPick={onChange} />
          {recenter && <Recenter position={recenter} />}
          {position && (
            <Marker
              position={position}
              draggable
              icon={pinIcon({ type: 'market' })}
              eventHandlers={{
                dragend: (e) => {
                  const p = e.target.getLatLng();
                  onChange({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
        <button type="button" className="btn btn-white btn-sm" onClick={useMyLocation}>
          <i className="bi bi-crosshair" /> {t('Use my current location')}
        </button>
        <span className="small text-muted-2">{t('Click on the map or drag the pin to set the exact pickup point.')}</span>
      </div>
      {error && <div className="small text-danger mt-1">{error}</div>}
    </div>
  );
}
